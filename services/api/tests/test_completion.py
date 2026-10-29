from fastapi.testclient import TestClient
from main import app


def test_completed_services_persist_without_changing_optimizer_inputs():
    client=TestClient(app)
    assert client.post('/api/auth/register',json={'username':'completed-doctor','password':'Completed-services-123!'}).status_code==201
    work={'id':'c','name':'Consultas','type':'Consulta','net_cents':10000,'minutes':60,'quantity':10,'max_extra':3}
    monthly={'id':'m','name':'Contrato','type':'Serviço mensal','net_cents':20000,'minutes':60,'quantity':1,'max_extra':0,'completed':1}
    plan={'works':[dict(work,completed=7),monthly],'expenses':[],'target':200000,'available':9600,'saved':[],'demo':False,'onboardingComplete':True}
    store={'version':1,'months':{'2026-10':plan}}
    assert client.put('/api/plan',json={'revision':0,'store':store}).status_code==200
    other=TestClient(app)
    assert other.post('/api/auth/login',json={'username':'completed-doctor','password':'Completed-services-123!'}).status_code==200
    saved=other.get('/api/plan').json()['store']['months']['2026-10']['works']
    assert [w['completed'] for w in saved]==[7,1]
    payload={'works':[work,monthly],'expenses_cents':0,'target_cents':200000,'available_minutes':9600}
    baseline=client.post('/api/optimizer',json=payload).json()
    payload['works'][0]=dict(work,completed=12)
    assert client.post('/api/optimizer',json=payload).json()==baseline
    for invalid in [-1,1.5,True,1001]:
        store['months']['2026-10']['works'][0]['completed']=invalid
        assert client.put('/api/plan',json={'revision':1,'store':store}).status_code==422
    store['months']['2026-10']['works'][0]['completed']=0
    store['months']['2026-10']['works'][1]['completed']=2
    assert client.put('/api/plan',json={'revision':1,'store':store}).status_code==422
