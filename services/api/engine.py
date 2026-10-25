"""Deterministic monthly planning, integer cents and committed minutes."""
from itertools import product
from math import prod
from fractions import Fraction

ENGINE_VERSION = '1.4.0'
MAX_MONTHLY_MINUTES = 280 * 60


def overtime_scenario(works, base_minutes, available_minutes, net, gap):
    """Exact unbounded knapsack: highest net income within remaining minutes.

    Only this hypothetical comparison relaxes positive per-work unit limits.
    A zero max_extra still disables the activity. Complexity O(280*60*n).
    """
    room = MAX_MONTHLY_MINUTES - base_minutes
    if room <= 0 or gap <= 0:
        return None, 'Não há espaço adicional até o teto de 280h, ou a meta já foi alcançada.'
    enabled = [(i,w) for i,w in enumerate(works) if w['max_extra'] > 0 and w['minutes'] <= room]
    if not enabled:
        return None, 'Nenhuma atividade habilitada cabe nas horas restantes até 280h. Limite zero mantém a atividade excluída.'
    values = [-1] * (room+1)
    choice = [-1] * (room+1)
    values[0] = 0
    for minute in range(1,room+1):
        for index,work in enabled:
            before = minute-work['minutes']
            if before >= 0 and values[before] >= 0:
                income = values[before]+work['net_cents']
                if income > values[minute]:
                    values[minute] = income
                    choice[minute] = index
    used = max(range(room+1),key=lambda minute:(values[minute],-minute))
    if used == 0:
        return None, 'Nenhuma atividade cabe nas horas restantes até 280h.'
    counts = [0]*len(works)
    cursor = used
    while cursor:
        index = choice[cursor]
        counts[index] += 1
        cursor -= works[index]['minutes']
    income = values[used]
    total = base_minutes+used
    exceeded = [dict(work_id=w['id'],name=w['name'],configured_max=w['max_extra'],
                     simulated_quantity=n,excess_quantity=n-w['max_extra'])
                for n,w in zip(counts,works) if n>w['max_extra']]
    if total <= available_minutes and not exceeded:
        return None, 'A maior renda possível até 280h já está dentro dos limites configurados.'
    return dict(counts=counts,extra_cents=income,minutes=used,projected_cents=net+income,
                total_minutes=total,label='Maior renda estimada até 280h',
                reaches_target=income>=gap,shortfall_cents=max(0,gap-income),
                exceeds_availability=total>available_minutes,
                excess_minutes=max(0,total-available_minutes),hard_limit_minutes=MAX_MONTHLY_MINUTES,
                unused_capacity_minutes=room-used,unit_limit_excess=exceeded,
                algorithm='unbounded_knapsack_minutes_v1',objective='maximum_net_income',
                items=[dict(work_id=w['id'],name=w['name'],quantity=n,
                            extra_cents=n*w['net_cents'],minutes=n*w['minutes'])
                       for n,w in zip(counts,works) if n>0]), None


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
        return dict(**common, status='over_capacity', scenarios=[], maximum_extra_cents=0, overtime_scenario=warning, overtime_note=note)
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
    warning, note = overtime_scenario(works,base_minutes,available_minutes,net,gap) if not feasible else (None,None)
    return dict(**common, status='feasible' if feasible else 'infeasible', scenarios=selected, overtime_scenario=warning, overtime_note=note,
                maximum_extra_cents=best_partial['extra_cents'] if best_partial else 0,
                best_partial=best_partial if not feasible else None)
