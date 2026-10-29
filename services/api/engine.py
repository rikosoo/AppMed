"""Deterministic monthly planning, integer cents and committed minutes."""
from itertools import product, combinations
from math import prod

ENGINE_VERSION = '1.11.0'
MAX_MONTHLY_MINUTES = 360 * 60


def select_diverse(pool, first, gap, works, preference='balanced', limit=3, wide=False):
    """Keep the exact primary; select materially different, useful alternatives.

    Diversity uses integer normalized quantity distances. Partial alternatives
    prefer 65% of primary income for broad regular mixes (50% for variety,
    80% for time/expanded mixes) when available among mixed options.
    This is a selection heuristic, not a second financial optimum.
    """
    if first is None:
        return []
    selected=[first]
    seen={tuple(first['counts'])}
    references=[max(1,max(row['counts'][i] for row in pool)) for i in range(len(first['counts']))]
    thresholds=[max(1,(value*2+4)//5 if wide and preference!='time' else (value+4)//5) for value in references]
    for _ in range(limit-1):
        candidates=[row for row in pool if tuple(row['counts']) not in seen]
        mixed=[row for row in candidates if sum(n>0 for n in row['counts'])>=2]
        if mixed:
            candidates=mixed
        if first['extra_cents']<gap:
            floor=(50 if preference=='variety' else 65) if wide and preference!='time' else 80
            useful=[row for row in candidates if row['extra_cents']*100>=first['extra_cents']*floor]
            if useful:
                candidates=useful
        balanced=[row for row in candidates if sum(n*w['net_cents']*5>=row['extra_cents'] for n,w in zip(row['counts'],works) if n>0)>=2]
        if balanced:
            candidates=balanced
        if preference!='time':
            distinct=[row for row in candidates if all(sum(abs(a-b)>=threshold for a,b,threshold in zip(row['counts'],old['counts'],thresholds))>=2 for old in selected)]
            if distinct:
                candidates=distinct
        if not candidates:
            break
        covered=[any(row['counts'][i]>0 for row in selected) for i in range(len(references))]
        def score(row):
            counts=row['counts']
            novelty=sum(n>0 and not covered[i] for i,n in enumerate(counts))
            material=min(sum(abs(a-b)>=threshold for a,b,threshold in zip(counts,old['counts'],thresholds)) for old in selected)
            changed=sum(sum(a!=b for a,b in zip(counts,old['counts'])) for old in selected)
            distance=min(sum(abs(a-b)*1000//reference for a,b,reference in zip(counts,old['counts'],references)) for old in selected)
            quality=(-row['minutes'],-row['extra_cents']) if row['extra_cents']>=gap else (row['extra_cents'],-row['minutes'])
            concentration=max(n*w['net_cents'] for n,w in zip(counts,works))*1000//max(1,row['extra_cents'])
            if preference=='time':
                return (-row['minutes'], -row['extra_cents'] if row['extra_cents']>=gap else row['extra_cents'],novelty,material,changed,distance,tuple(counts))
            if wide and preference!='time':
                return (novelty,distance,material,-concentration if preference=='balanced' else changed,*quality,tuple(counts))
            if preference=='balanced':
                return (novelty,-concentration,material,changed,distance,*quality,tuple(counts))
            return (novelty,material,changed,distance,sum(n>0 for n in counts),*quality,tuple(counts))
        row=max(candidates,key=score)
        selected.append(row)
        seen.add(tuple(row['counts']))
    return selected


def overtime_scenario(works, base_minutes, available_minutes, net, gap, preference='balanced'):
    """Exact minimum-time primary, then bounded quota-based diverse mixes.

    Only hypothetical options relax positive unit limits; zero stays excluded.
    Alternatives sample 25/50/75% income allocations, including combinations
    of two locked activities to offer three-activity mixes when feasible.
    """
    room = MAX_MONTHLY_MINUTES-base_minutes
    if room <= 0 or gap <= 0:
        return [], 'Não há espaço adicional até o teto de 360h, ou a meta já foi alcançada.'
    enabled = [(i,w) for i,w in enumerate(works) if w['max_extra']>0 and w['minutes']<=room]
    if not enabled:
        return [], 'Nenhuma atividade habilitada cabe nas horas restantes até 360h. Limite zero mantém a atividade excluída.'

    def solve(locked=None):
        locked=locked or {}
        forced_minutes=sum(works[i]['minutes']*n for i,n in locked.items())
        forced_income=sum(works[i]['net_cents']*n for i,n in locked.items())
        capacity = room-forced_minutes
        if capacity < 0:
            return None
        values, choice = [-1]*(capacity+1), [-1]*(capacity+1)
        values[0] = forced_income
        reached = 0 if forced_income>=gap else None
        free=[(index,w) for index,w in enabled if index not in locked]
        for minute in range(1,capacity+1):
            if reached is not None:
                break
            for index,w in free:
                before=minute-w['minutes']
                if before>=0 and values[before]>=0 and values[before]+w['net_cents']>values[minute]:
                    values[minute]=values[before]+w['net_cents']
                    choice[minute]=index
            if values[minute]>=gap:
                reached=minute
        used = reached if reached is not None else max(range(capacity+1),key=lambda m:(values[m],-m))
        if values[used]<=0 or forced_minutes+used==0:
            return None
        counts=[locked.get(i,0) for i in range(len(works))]
        cursor=used
        while cursor:
            index=choice[cursor]
            counts[index]+=1
            cursor-=works[index]['minutes']
        income=values[used]
        # Remove unnecessary work added solely by an anchor. In particular,
        # 66 consultations + 1 redundant telemedicine must not become an option.
        if income>=gap:
            for index in sorted(range(len(works)),key=lambda i:works[i]['minutes'],reverse=True):
                remove=min(counts[index],(income-gap)//works[index]['net_cents'])
                counts[index]-=remove
                income-=remove*works[index]['net_cents']
        minutes=sum(n*w['minutes'] for n,w in zip(counts,works))
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
                    unit_limit_excess=exceeded,algorithm='target_minimum_minutes_dp_v2',
                    objective='reach_target_minimum_minutes',
                    items=[dict(work_id=w['id'],name=w['name'],quantity=n,extra_cents=n*w['net_cents'],minutes=n*w['minutes'])
                           for n,w in zip(counts,works) if n>0])

    primary=solve()
    if not primary:
        return [], 'Não há alternativa ampliada além dos limites já configurados.'
    candidates=[primary]
    seen={tuple(primary['counts'])}
    budget=min(gap,primary['extra_cents'])
    def add(locked):
        row=solve(locked)
        if row and sum(n>0 for n in row['counts'])>=2 and tuple(row['counts']) not in seen:
            candidates.append(row)
            seen.add(tuple(row['counts']))
    def quota(index,numerator):
        denominator=4*works[index]['net_cents']
        return max(1,(budget*numerator+denominator-1)//denominator)
    for index,_ in enabled:
        for quantity in sorted({1,2,quota(index,1),quota(index,2),quota(index,3)}):
            add({index:quantity})
    if len(enabled)>=3:
        for (left,_),(right,_) in combinations(enabled,2):
            for a,b in ((1,1),(1,2),(2,1)):
                add({left:quota(left,a),right:quota(right,b)})
    reached=[row for row in candidates if row['reaches_target']]
    pool=reached or candidates
    selected=select_diverse(pool,primary,gap,works,preference)
    for index,row in enumerate(selected):
        types=sum(n>0 for n in row['counts'])
        row['label']=('Menor tempo para a meta' if reached else 'Maior alcance até 360h') if index==0 else (f'Mix alternativo {index} · {types} atividades' if types>1 else f'Alternativa {index} · 1 atividade')
        row['objective']=('reach_target_minimum_minutes' if reached else 'maximize_income_within_cap') if index==0 else ('reach_target_diverse_mix' if reached else 'diverse_partial_mix')
    return selected, None if reached else 'Mesmo ampliando as unidades, a meta não cabe em 360h. As alternativas exibidas são parciais e informam quanto ainda falta.'


def optimize(works, expenses_cents, target_cents, available_minutes, preference='balanced'):
    if preference not in ('balanced','time','variety'):
        raise ValueError('Selecione uma prioridade válida para os cenários.')
    if available_minutes > MAX_MONTHLY_MINUTES:
        raise ValueError('A disponibilidade mensal não pode ultrapassar 360 horas.')
    base_income = sum(w['net_cents'] * w['quantity'] for w in works)
    base_minutes = sum(w['minutes'] * w['quantity'] for w in works)
    net = base_income - expenses_cents
    gap = max(0, target_cents - net)
    remaining = max(0, available_minutes - base_minutes)
    common = dict(preference=preference,engine_version=ENGINE_VERSION, projected_cents=net, gap_cents=gap,
                  committed_minutes=base_minutes, remaining_minutes=remaining)
    if base_minutes > available_minutes:
        warning, note = overtime_scenario(works,base_minutes,available_minutes,net,gap,preference)
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
            # A reaching alternative must not add individually removable units.
            if income-gap < min(w['net_cents'] for n,w in zip(counts,works) if n>0):
                feasible.append(row)
        elif income > 0:
            partial.append(row)

    pool = feasible or partial
    key=(lambda row:(row['minutes'],row['extra_cents']-gap)) if feasible else (lambda row:(-row['extra_cents'],row['minutes']))
    primary=min(pool,key=key) if pool else None
    rows=select_diverse(pool,primary,gap,works,preference,wide=True)
    selected=[]
    for index,row in enumerate(rows):
        label=('Menos horas adicionais' if feasible else 'Maior alcance possível') if index==0 else (f"Mix alternativo {index} · {sum(n>0 for n in row['counts'])} atividades" if sum(n>0 for n in row['counts'])>1 else f'Alternativa {index} · 1 atividade')
        items = [dict(work_id=w['id'], name=w['name'], quantity=n,
                      extra_cents=n*w['net_cents'], minutes=n*w['minutes'])
                 for n, w in zip(row['counts'], works) if n > 0]
        selected.append(dict(**row, label=label, items=items,
                             reaches_target=row['extra_cents'] >= gap,
                             shortfall_cents=max(0, gap-row['extra_cents']),
                             total_minutes=base_minutes+row['minutes']))
    warning, note = overtime_scenario(works,base_minutes,available_minutes,net,gap,preference) if not feasible else ([],None)
    return dict(**common, status='feasible' if feasible else 'infeasible', scenarios=selected, overtime_scenarios=warning, overtime_scenario=warning[0] if warning else None, overtime_note=note,
                maximum_extra_cents=best_partial['extra_cents'] if best_partial else 0,
                best_partial=best_partial if not feasible else None)
