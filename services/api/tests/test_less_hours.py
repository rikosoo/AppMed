from itertools import product
import random
from fastapi.testclient import TestClient
from main import app
from less_hours import less_hours


def work(name,price,minutes,quantity,extra,completed=0):
    return dict(id=name,name=name,type='Consulta',net_cents=price,minutes=minutes,quantity=quantity,max_extra=extra,completed=completed)


def test_three_options_reconcile_money_time_and_keep_fixed_and_completed():
    works=[work('consultas',40000,60,10,30,3),work('plantao',100000,720,6,4),work('tele',18000,30,20,40),dict(work('mensal',200000,600,1,0,1),type='Serviço mensal')]
    result=less_hours(works,12345,15000)
    assert len(result['scenarios'])==3
    assert result==less_hours(works,12345,15000)
    assert len({tuple(s['counts']) for s in result['scenarios']})==3
    for row in result['scenarios']:
        assert row['revenue_cents']==sum(n*w['net_cents'] for n,w in zip(row['counts'],works))
        assert row['net_cents']==row['revenue_cents']-12345>=result['baseline_net_cents']
        assert row['minutes']==sum(n*w['minutes'] for n,w in zip(row['counts'],works))<result['baseline_minutes']
        assert row['saved_minutes']==result['baseline_minutes']-row['minutes']
        assert row['counts'][0]>=3 and row['counts'][3]==1
        assert sum(i['revenue_cents'] for i in row['items'])==row['revenue_cents']
        assert sum(i['minutes'] for i in row['items'])==row['minutes']


def test_primary_matches_exhaustive_search_on_small_instances():
    rng=random.Random(2841)
    for _ in range(60):
        works=[work(str(i),rng.randint(1,20),rng.randint(1,15),rng.randint(0,4),rng.randint(0,3)) for i in range(3)]
        available=rng.randint(1,150)
        income=sum(w['net_cents']*w['quantity'] for w in works)
        baseline=sum(w['minutes']*w['quantity'] for w in works)
        ranges=[range(w['quantity'],w['quantity']+1) if w['max_extra']==0 else range(w['quantity']+w['max_extra']+1) for w in works]
        valid=[sum(n*w['minutes'] for n,w in zip(counts,works)) for counts in product(*ranges) if sum(n*w['net_cents'] for n,w in zip(counts,works))>=income and sum(n*w['minutes'] for n,w in zip(counts,works))<baseline and sum(n*w['minutes'] for n,w in zip(counts,works))<=available]
        result=less_hours(works,7,available)
        assert bool(result['scenarios'])==bool(valid)
        if valid:assert result['scenarios'][0]['minutes']==min(valid)


def test_no_fake_savings_when_fixed_already_completed_or_no_income():
    for works in [[],[work('a',100,60,10,0)],[work('a',100,60,10,5,10)],[work('a',100,60,0,5)]]:
        assert less_hours(works,0,21600)['scenarios']==[]
    assert less_hours([work('a',100,60,10,5)],0,0)['scenarios']==[]


def test_endpoint_requires_account_and_keeps_plan_unchanged():
    client=TestClient(app)
    works=[work('slow',10000,120,10,5),work('fast',20000,60,0,10)]
    payload={'works':works,'expenses_cents':1000,'available_minutes':21600}
    assert client.post('/api/optimizer/less-hours',json=payload).status_code==401
    assert client.post('/api/auth/register',json={'username':'less-hours-doctor','password':'Less-hours-password-123!'}).status_code==201
    before=client.get('/api/plan').json()
    result=client.post('/api/optimizer/less-hours',json=payload)
    assert result.status_code==200 and result.json()['scenarios']
    assert client.get('/api/plan').json()==before
    assert client.post('/api/optimizer/less-hours',json=payload,headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/optimizer/less-hours',json={**payload,'available_minutes':21601}).status_code==422
