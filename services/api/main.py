from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from engine import optimize

app = FastAPI(title='FinanceMed AI', version='0.1.0')

class Work(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(default='Outro', max_length=50)
    net_cents: int = Field(strict=True, gt=0, le=100_000_000)
    minutes: int = Field(strict=True, ge=1, le=43200)
    quantity: int = Field(strict=True, ge=0, le=1000)
    max_extra: int = Field(strict=True, ge=0, le=100)

class OptimizationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    works: list[Work] = Field(max_length=6)
    expenses_cents: int = Field(strict=True, ge=0, le=1_000_000_000)
    target_cents: int = Field(strict=True, gt=0, le=1_000_000_000)
    available_minutes: int = Field(strict=True, ge=0, le=43200)

@app.get('/api/health')
def health():
    return {'status': 'ok', 'engine': '1.0.0'}

@app.post('/api/optimizer')
def optimizer(data: OptimizationRequest):
    if len({w.id for w in data.works}) != len(data.works):
        raise HTTPException(422, 'Cada trabalho deve ter um identificador único.')
    try:
        return optimize([w.model_dump() for w in data.works], data.expenses_cents,
                        data.target_cents, data.available_minutes)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
