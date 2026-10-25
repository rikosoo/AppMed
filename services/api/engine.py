"""Deterministic monthly planning, integer cents and committed minutes."""
from itertools import product
from math import prod

ENGINE_VERSION = '1.0.0'

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
    feasible, best_partial = [], None
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
    selected, seen = [], set()
    rankings = [
        ('Menos tempo', lambda r: (r['minutes'], r['extra_cents'] - gap)),
        ('Alternativa de renda', lambda r: (r['extra_cents'] - gap, r['minutes'])),
        ('Combinação alternativa', lambda r: (-sum(n > 0 for n in r['counts']), r['minutes'], r['extra_cents'])),
    ]
    for label, key in rankings:
        candidates = sorted(feasible, key=key)
        row = next((r for r in candidates if tuple(r['counts']) not in seen), None)
        if row:
            seen.add(tuple(row['counts']))
            selected.append(dict(**row, label=label))
    return dict(**common, status='feasible' if feasible else 'infeasible', scenarios=selected,
                maximum_extra_cents=best_partial['extra_cents'] if best_partial else 0,
                best_partial=best_partial if not feasible else None)
