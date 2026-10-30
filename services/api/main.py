from fastapi import FastAPI, HTTPException, Depends, Request, Response
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal, Any
import json
import os
from threading import BoundedSemaphore
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from security import ApiSecurity, limits_enabled, consume_budget
from accounts import router as accounts_router, require_user, check_origin, connect, require_current_session
from recovery import router as recovery_router
from admin import router as admin_router, record_event
from finance import after_tax
from engine import ENGINE_VERSION, MAX_MONTHLY_MINUTES, optimize

production=os.environ.get('SESSION_COOKIE_SECURE','false').lower()=='true'
app = FastAPI(title='Axterix Med', version='0.2.0',docs_url=None if production else '/docs',redoc_url=None if production else '/redoc',openapi_url=None if production else '/openapi.json')
app.add_middleware(ApiSecurity)

@app.exception_handler(RequestValidationError)
async def invalid_input(request:Request,error:RequestValidationError):
    # Pydantic's default output includes submitted passwords and complete financial objects.
    return JSONResponse({'detail':'Revise os campos informados.'},status_code=422,headers={'Cache-Control':'no-store'})
app.include_router(accounts_router)
app.include_router(recovery_router)
app.include_router(admin_router)

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
    completed: int = Field(default=0, strict=True, ge=0, le=1000)
    max_extra: int = Field(strict=True, ge=0, le=100)

    @model_validator(mode='after')
    def validate_estimated_tax(self):
        if self.type=='Serviço mensal' and self.completed>1:
            raise ValueError('Serviço mensal só pode ser concluído uma vez no mês.')
        if self.type=='Serviço mensal' and (self.quantity!=1 or self.max_extra!=0):
            raise ValueError('Serviço mensal deve contar uma vez no mês e não permite unidades extras.')
        if self.gross_cents is None and self.tax_regime is None:
            return self  # Preserve legacy amounts already entered as net.
        if self.gross_cents is None or self.tax_regime is None:
            raise ValueError('Informe o valor bruto e selecione PF ou PJ.')
        if self.net_cents != after_tax(self.gross_cents, self.tax_regime):
            raise ValueError('O líquido deve corresponder ao desconto estimado do regime escolhido.')
        return self

class OptimizationRequest(BaseModel):
    preference:Literal['balanced','time','variety']='balanced'
    model_config = ConfigDict(extra='forbid')
    works: list[Work] = Field(max_length=6)
    expenses_cents: int = Field(strict=True, ge=0, le=1_000_000_000)
    target_cents: int = Field(strict=True, gt=0, le=1_000_000_000)
    available_minutes: int = Field(strict=True, ge=0, le=MAX_MONTHLY_MINUTES)

@app.get('/api/health')
def health():
    with connect() as db:
        db.execute('SELECT 1')
    return {'status': 'ok', 'engine': ENGINE_VERSION}

_optimizer_slots=BoundedSemaphore(2)

@app.post('/api/optimizer')
def optimizer(data: OptimizationRequest, user=Depends(require_user)):
    if limits_enabled():consume_budget('optimizer-user:'+user['id'],20,60)
    if len({w.id for w in data.works}) != len(data.works):
        raise HTTPException(422, 'Cada trabalho deve ter um identificador único.')
    if not _optimizer_slots.acquire(blocking=False):
        raise HTTPException(429,'Há outros cálculos em andamento. Tente novamente em instantes.',headers={'Retry-After':'2'})
    try:
        result = optimize([w.model_dump() for w in data.works], data.expenses_cents,
                        data.target_cents, data.available_minutes, data.preference)
        with connect() as db:
            record_event(db,user["id"],"optimizer_used")
        return result
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    finally:
        _optimizer_slots.release()

class LessHoursRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    works:list[Work]=Field(max_length=6)
    expenses_cents:int=Field(strict=True,ge=0,le=1_000_000_000)
    available_minutes:int=Field(strict=True,ge=0,le=MAX_MONTHLY_MINUTES)

@app.post('/api/optimizer/less-hours')
def optimize_less_hours(data:LessHoursRequest,user=Depends(require_user)):
    from less_hours import less_hours
    if len({w.id for w in data.works})!=len(data.works):
        raise HTTPException(422,'Cada trabalho deve ter um identificador único.')
    if limits_enabled():consume_budget('optimizer-user:'+user['id'],20,60)
    if not _optimizer_slots.acquire(blocking=False):
        raise HTTPException(429,'Há outros cálculos em andamento. Tente novamente em instantes.',headers={'Retry-After':'2'})
    try:
        result=less_hours([w.model_dump() for w in data.works],data.expenses_cents,data.available_minutes)
        with connect() as db:record_event(db,user['id'],'optimizer_used')
        return result
    finally:_optimizer_slots.release()

class Expense(BaseModel):
    id:str=Field(min_length=1,max_length=100)
    name:str=Field(min_length=1,max_length=100)
    category:str=Field(max_length=100)
    cents:int=Field(strict=True,ge=0,le=1_000_000_000)

class StoredWork(Work):
    # Preserve readable legacy history. The optimizer still enforces 360h.
    minutes:int=Field(strict=True,ge=1,le=43200)

class MonthlyPlan(BaseModel):
    works:list[StoredWork]=Field(max_length=6)
    expenses:list[Expense]=Field(max_length=1000)
    target:int=Field(strict=True,ge=0,le=1_000_000_000)
    available:int=Field(strict=True,ge=0,le=43200)
    saved:list[dict[str,Any]]=Field(default_factory=list,max_length=1000)
    demo:bool=False
    onboardingComplete:bool=False

class StoredPlan(BaseModel):
    version:Literal[1]
    months:dict[str,MonthlyPlan]=Field(max_length=240)

class PlanUpdate(BaseModel):
    model_config=ConfigDict(extra='forbid')
    store:StoredPlan
    revision:int=Field(strict=True,ge=0)

@app.put('/api/plan')
def update_plan(data:PlanUpdate,request:Request,response:Response,user=Depends(require_user)):
    import re
    check_origin(request)
    if any(not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',month) for month in data.store.months):
        raise HTTPException(422,'Competência inválida no planejamento.')
    for plan in data.store.months.values():
        if len({w.id for w in plan.works})!=len(plan.works):
            raise HTTPException(422,'Cada trabalho precisa de um identificador único.')
    document=json.dumps(data.store.model_dump(exclude_none=True),ensure_ascii=False)
    if len(document.encode())>2_000_000:
        raise HTTPException(413,'Seu planejamento excede o limite de tamanho. Exporte uma cópia e reduza o histórico salvo.')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        require_current_session(db,request,user)
        row=db.execute('SELECT revision,document FROM plans WHERE user_id=?',(user['id'],)).fetchone()
        current=row['revision'] if row else 0
        if data.revision!=current:
            raise HTTPException(409,'O planejamento foi atualizado em outra aba ou dispositivo. Exporte suas alterações locais e recarregue antes de continuar.')
        revision=current+1
        db.execute('INSERT INTO plans (user_id,document,revision) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=excluded.revision',(user['id'],document,revision))
        record_event(db,user['id'],'plan_saved')
        completed=any(p.onboardingComplete for p in data.store.months.values())
        previous=json.loads(row['document']) if row else {'months':{}}
        was_completed=any(p.get('onboardingComplete') for p in previous['months'].values())
        already=db.execute("SELECT 1 FROM usage_daily WHERE user_id=? AND event='onboarding_completed'",(user['id'],)).fetchone()
        if completed and not was_completed and not already:
            record_event(db,user['id'],'onboarding_completed')
    response.headers['Cache-Control']='no-store'
    return {'revision':revision}
