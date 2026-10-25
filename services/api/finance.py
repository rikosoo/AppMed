"""User-selected fixed estimates; not an official tax assessment."""
TAX_PERCENT = {'PF': 27, 'PJ': 15}

def after_tax(gross_cents: int, regime: str) -> int:
    tax_cents = (gross_cents * TAX_PERCENT[regime] + 50) // 100
    return gross_cents - tax_cents
