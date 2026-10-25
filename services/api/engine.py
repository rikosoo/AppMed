"""Deterministic monthly planning, integer cents and committed minutes."""
from itertools import product
from math import prod
from fractions import Fraction

ENGINE_VERSION = '1.1.0'


def optimize(works, expenses_cents, target_cents, available_minutes):
    base_income = sum(w['net_cents'] * w['quantity'] for w in works)
    base_minutes = sum(w['minutes'] * w['quantity'] for w in works)
    net = base_income - expenses_cents
    gap = max(0, target_cents - net)
    remaining = max(0, available_minutes - base_minutes)
    common = dict(engine_version=ENGINE_VERSION, projected_cents=net, gap_cents=gap,
                  committed_minutes=base_minutes, remaining_minutes=remaining)
    if base_minutes > available_minutes:
        return dict(**common, status='over_capacity', scenarios=[], maximum_extra_cents=0)
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
    return dict(**common, status='feasible' if feasible else 'infeasible', scenarios=selected,
                maximum_extra_cents=best_partial['extra_cents'] if best_partial else 0,
                best_partial=best_partial if not feasible else None)
