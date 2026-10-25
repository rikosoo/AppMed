from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal
from finance import after_tax
from engine import ENGINE_VERSION, MAX_MONTHLY_MINUTES, optimize

app = FastAPI(title='FinanceMed AI', version='0.1.0')

class Work(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(default='Outro', max_length=50)
    gross_cents: int | None = Field(default=None, strict=True, gt=0, le=100_000_000)
    tax_regime: Literal['PF', 'PJ'] | None = None
    net_cents: int = Field(strict=True, gt=0, le=100_000_000)
    minutes: int = Field(strict=True, ge=1, le=MAX_MONTHLY_MINUTES)
    quantity: int = Field(strict=True, ge=0, le=1000)
    max_extra: int = Field(strict=True, ge=0, le=100)

    @model_validator(mode='after')
    def validate_estimated_tax(self):
        if self.gross_cents is None and self.tax_regime is None:
            return self  # Preserve legacy amounts already entered as net.
        if self.gross_cents is None or self.tax_regime is None:
            raise ValueError('Informe o valor bruto e selecione PF ou PJ.')
        if self.net_cents != after_tax(self.gross_cents, self.tax_regime):
            raise ValueError('O líquido deve corresponder ao desconto estimado do regime escolhido.')
        return self

class OptimizationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    works: list[Work] = Field(max_length=6)
    expenses_cents: int = Field(strict=True, ge=0, le=1_000_000_000)
    target_cents: int = Field(strict=True, gt=0, le=1_000_000_000)
    available_minutes: int = Field(strict=True, ge=0, le=MAX_MONTHLY_MINUTES)

@app.get('/api/health')
def health():
    return {'status': 'ok', 'engine': ENGINE_VERSION}

@app.post('/api/optimizer')
def optimizer(data: OptimizationRequest):
    if len({w.id for w in data.works}) != len(data.works):
        raise HTTPException(422, 'Cada trabalho deve ter um identificador único.')
    try:
        return optimize([w.model_dump() for w in data.works], data.expenses_cents,
                        data.target_cents, data.available_minutes)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
