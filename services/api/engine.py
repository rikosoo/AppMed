"""Deterministic monthly planning, integer cents and committed minutes."""
from itertools import product
from math import prod
from fractions import Fraction

ENGINE_VERSION = '1.5.0'
MAX_MONTHLY_MINUTES = 280 * 60


def overtime_scenario(works, base_minutes, available_minutes, net, gap):
    """Find minimum additional minutes to reach the gap, plus distinct mixes.

    Exact DP for the minimum-time option. Alternatives lock one slower activity
    at one or two units, then solve the remaining target with the same DP.
    Only hypothetical options relax positive unit limits; zero stays excluded.
    """
    room = MAX_MONTHLY_MINUTES-base_minutes
    if room <= 0 or gap <= 0:
        return [], 'Não há espaço adicional até o teto de 280h, ou a meta já foi alcançada.'
    enabled = [(i,w) for i,w in enumerate(works) if w['max_extra']>0 and w['minutes']<=room]
    if not enabled:
        return [], 'Nenhuma atividade habilitada cabe nas horas restantes até 280h. Limite zero mantém a atividade excluída.'

    def solve(locked=None, quantity=0):
        forced_minutes = works[locked]['minutes']*quantity if locked is not None else 0
        forced_income = works[locked]['net_cents']*quantity if locked is not None else 0
        capacity = room-forced_minutes
        if capacity < 0:
            return None
        values, choice = [-1]*(capacity+1), [-1]*(capacity+1)
        values[0] = forced_income
        reached = 0 if forced_income>=gap else None
        for minute in range(1,capacity+1):
            if reached is not None:
                break
            for index,w in enabled:
                if index==locked:
                    continue
                before=minute-w['minutes']
                if before>=0 and values[before]>=0 and values[before]+w['net_cents']>values[minute]:
                    values[minute]=values[before]+w['net_cents']
                    choice[minute]=index
            if values[minute]>=gap:
                reached=minute
        used = reached if reached is not None else max(range(capacity+1),key=lambda m:(values[m],-m))
        if values[used]<=0 or forced_minutes+used==0:
            return None
        counts=[0]*len(works)
        if locked is not None:
            counts[locked]=quantity
        cursor=used
        while cursor:
            index=choice[cursor]
            counts[index]+=1
            cursor-=works[index]['minutes']
        income=values[used]
        minutes=used+forced_minutes
        total=base_minutes+minutes
        exceeded=[dict(work_id=w['id'],name=w['name'],configured_max=w['max_extra'],
                       simulated_quantity=n,excess_quantity=n-w['max_extra'])
                  for n,w in zip(counts,works) if n>w['max_extra']]
        if total<=available_minutes and not exceeded:
            return None
        return dict(counts=counts,extra_cents=income,minutes=minutes,projected_cents=net+income,
                    total_minutes=total,reaches_target=income>=gap,shortfall_cents=max(0,gap-income),
                    exceeds_availability=total>available_minutes,excess_minutes=max(0,total-available_minutes),
                    hard_limit_minutes=MAX_MONTHLY_MINUTES,unused_capacity_minutes=room-minutes,
                    unit_limit_excess=exceeded,algorithm='target_minimum_minutes_dp_v1',
                    objective='reach_target_minimum_minutes',
                    items=[dict(work_id=w['id'],name=w['name'],quantity=n,extra_cents=n*w['net_cents'],minutes=n*w['minutes'])
                           for n,w in zip(counts,works) if n>0])

    candidates=[]
    primary=solve()
    if not primary:
        return [], 'Não há alternativa ampliada além dos limites já configurados.'
    candidates.append(primary)
    efficient=max(enabled,key=lambda pair:Fraction(pair[1]['net_cents'],pair[1]['minutes']))[0]
    for index,_ in enabled:
        if index==efficient:
            continue
        for quantity in (1,2):
            row=solve(index,quantity)
            if row and row['counts'] not in [r['counts'] for r in candidates]:
                candidates.append(row)
    if not candidates:
        return [], 'Não há alternativa ampliada além dos limites já configurados.'
    reached=[r for r in candidates if r['reaches_target']]
    pool=reached or candidates
    pool.sort(key=(lambda r:(r['minutes'],r['extra_cents']-gap)) if reached else (lambda r:(-r['extra_cents'],r['minutes'])))
    selected=pool[:3]
    for index,row in enumerate(selected):
        row['label']=('Menor tempo para a meta' if index==0 else f'Mix alternativo {index}') if reached else ('Maior alcance até 280h' if index==0 else f'Alternativa parcial {index}')
    return selected, None if reached else 'Mesmo ampliando as unidades, a meta não cabe em 280h. As alternativas exibidas são parciais e informam quanto ainda falta.'


def optimize(works, expenses_cents, target_cents, available_minutes):
    if available_minutes > MAX_MONTHLY_MINUTES:
        raise ValueError('A disponibilidade mensal não pode ultrapassar 280 horas.')
    base_income = sum(w['net_cents'] * w['quantity'] for w in works)
    base_minutes = sum(w['minutes'] * w['quantity'] for w in works)
    net = base_income - expenses_cents
    gap = max(0, target_cents - net)
    remaining = max(0, available_minutes - base_minutes)
    common = dict(engine_version=ENGINE_VERSION, projected_cents=net, gap_cents=gap,
                  committed_minutes=base_minutes, remaining_minutes=remaining)
    if base_minutes > available_minutes:
        warning, note = overtime_scenario(works,base_minutes,available_minutes,net,gap)
        return dict(**common, status='over_capacity', scenarios=[], maximum_extra_cents=0, overtime_scenarios=warning, overtime_scenario=warning[0] if warning else None, overtime_note=note)
    if gap == 0:
        return dict(**common, status='achieved', scenarios=[], maximum_extra_cents=0)
    bounds = [min(w['max_extra'], remaining // w['minutes']) for w in works]
    if prod(b + 1 for b in bounds) > 500_000:
        raise ValueError('Reduza os limites de atividades adicionais: esta versão compara até 500 mil combinações.')
    feasible, partial = [], []
    best_partial = None
    for counts in product(*(range(b + 1) for b in bounds)):
        minutes = sum(n * w['minutes'] for n, w in zip(counts, works))
        if minutes > remaining:
            continue
        income = sum(n * w['net_cents'] for n, w in zip(counts, works))
        row = dict(counts=list(counts), extra_cents=income, minutes=minutes,
                   projected_cents=net + income)
        if best_partial is None or (income, -minutes) > (best_partial['extra_cents'], -best_partial['minutes']):
            best_partial = row
        if income >= gap:
            feasible.append(row)
        elif income > 0:
            partial.append(row)

    # Prefer different allocations of the less efficient activities, rather than
    # three near-identical options with one additional consultation each.
    efficient = max(range(len(works)), key=lambda i: Fraction(works[i]['net_cents'], works[i]['minutes'])) if works else None
    def mix_key(row):
        return tuple(n for i, n in enumerate(row['counts']) if i != efficient)

    selected, seen, used_mixes = [], set(), set()
    pool = feasible or partial
    if feasible:
        rankings = [
            ('Menos horas adicionais', lambda r: (r['minutes'], r['extra_cents'] - gap)),
            ('Mix de atividades', lambda r: (r['extra_cents'] - gap, r['minutes'])),
            ('Outra combinação', lambda r: (r['minutes'], r['extra_cents'] - gap)),
        ]
    else:
        rankings = [(label, lambda r: (-r['extra_cents'], r['minutes'])) for label in
                    ('Maior alcance possível', 'Outro mix possível', 'Outra combinação')]
    for index, (label, key) in enumerate(rankings):
        candidates = [r for r in pool if tuple(r['counts']) not in seen]
        distinct_mix = [r for r in candidates if mix_key(r) not in used_mixes]
        if index and distinct_mix:
            candidates = distinct_mix
        if not candidates:
            break
        row = min(candidates, key=key)
        seen.add(tuple(row['counts']))
        used_mixes.add(mix_key(row))
        items = [dict(work_id=w['id'], name=w['name'], quantity=n,
                      extra_cents=n*w['net_cents'], minutes=n*w['minutes'])
                 for n, w in zip(row['counts'], works) if n > 0]
        selected.append(dict(**row, label=label, items=items,
                             reaches_target=row['extra_cents'] >= gap,
                             shortfall_cents=max(0, gap-row['extra_cents']),
                             total_minutes=base_minutes+row['minutes']))
    warning, note = overtime_scenario(works,base_minutes,available_minutes,net,gap) if not feasible else ([],None)
    return dict(**common, status='feasible' if feasible else 'infeasible', scenarios=selected, overtime_scenarios=warning, overtime_scenario=warning[0] if warning else None, overtime_note=note,
                maximum_extra_cents=best_partial['extra_cents'] if best_partial else 0,
                best_partial=best_partial if not feasible else None)
