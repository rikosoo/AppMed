from fastapi.testclient import TestClient
from main import app
from engine import optimize

client = TestClient(app)

def work(id='c', net=28000, minutes=60, quantity=0, extra=30):
    return dict(id=id, name=id, net_cents=net, minutes=minutes, quantity=quantity, max_extra=extra)

def test_mixed_scenarios_are_exact_and_within_capacity():
    works = [work(), work('p',180000,720,0,3), work('s',80000,720,0,3)]
    result = optimize(works, 0, 500000, 3000)
    assert len(result['scenarios']) == 3
    for s in result['scenarios']:
        assert s['extra_cents'] == sum(n*w['net_cents'] for n,w in zip(s['counts'],works))
        assert s['minutes'] == sum(n*w['minutes'] for n,w in zip(s['counts'],works))
        assert s['extra_cents'] >= 500000
        assert s['minutes'] <= 3000
    assert result['scenarios'][0]['counts'] == [18,0,0]

def test_expenses_and_existing_hours_are_counted_once():
    result = optimize([work(quantity=10)],100000,300000,660)
    assert result['projected_cents'] == 180000
    assert result['remaining_minutes'] == 60
    assert result['status'] == 'infeasible'
    assert result['maximum_extra_cents'] == 28000

def test_no_float_rounding():
    result = optimize([work(net=1001, minutes=1, extra=3)],1,3002,3)
    assert result['scenarios'][0]['projected_cents'] == 3002

def test_no_activities_and_negative_projection():
    result = optimize([],100,1000,600)
    assert result['projected_cents'] == -100
    assert result['status'] == 'infeasible'

def test_achieved_does_not_recommend_more_work():
    assert optimize([work(quantity=10)],0,100,600)['status'] == 'achieved'

def test_over_capacity_takes_priority_over_achieved():
    assert optimize([work(quantity=10)],0,100,500)['status'] == 'over_capacity'

def test_max_extra_zero():
    assert optimize([work(extra=0)],0,1,600)['maximum_extra_cents'] == 0

def test_endpoint_and_input_validation():
    assert client.get('/api/health').json()['status'] == 'ok'
    payload = dict(works=[dict(**work(), type='Consulta')],expenses_cents=0,target_cents=500000,available_minutes=1200)
    assert client.post('/api/optimizer',json=payload).status_code == 200
    payload['works'][0]['minutes'] = 0
    assert client.post('/api/optimizer',json=payload).status_code == 422
    payload['works'][0]['minutes'] = 1.5
    assert client.post('/api/optimizer',json=payload).status_code == 422

def test_complexity_limit_has_actionable_error():
    payload = dict(works=[work(str(i),minutes=1,extra=100) for i in range(6)],expenses_cents=0,target_cents=1,available_minutes=1000)
    response = client.post('/api/optimizer',json=payload)
    assert response.status_code == 422
    assert 'limites' in response.json()['detail']
