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


def test_screenshot_limits_return_three_honest_partial_mixes():
    works = [work('consultorio',50000,60,10,9), work('plantao',120000,720,1,2)]
    works[0]['name'] = 'Meu consultório particular'
    works[1]['name'] = 'Plantão no hospital'
    result = optimize(works,0,5000000,138*60)
    assert result['gap_cents'] == 4380000
    assert result['remaining_minutes'] == 116*60
    assert result['status'] == 'infeasible'
    assert result['maximum_extra_cents'] == 690000
    assert [s['counts'] for s in result['scenarios']] == [[9,2],[9,1],[9,0]]
    for s in result['scenarios']:
        assert not s['reaches_target']
        assert s['shortfall_cents'] == 5000000-s['projected_cents']
        assert s['total_minutes'] <= 138*60
        assert sum(i['minutes'] for i in s['items']) == s['minutes']
        assert sum(i['extra_cents'] for i in s['items']) == s['extra_cents']
        assert s['items'][0]['name'] == 'Meu consultório particular'


def test_expanded_consultation_limit_finds_three_distinct_allocations():
    works = [work('consultorio',50000,60,10,100), work('plantao',120000,720,1,2)]
    result = optimize(works,0,5000000,138*60)
    assert result['status'] == 'feasible'
    assert {tuple(s['counts']) for s in result['scenarios']} == {(88,0),(86,1),(83,2)}
    assert result['scenarios'][0]['counts'] == [88,0]
    for s in result['scenarios']:
        assert s['reaches_target']
        assert s['shortfall_cents'] == 0
        assert s['minutes'] <= 116*60
        assert s['total_minutes'] <= 138*60


def test_time_limit_caps_partial_suggestions_even_with_high_work_limits():
    result = optimize([work('consultorio',50000,60,0,100),work('plantao',120000,720,0,20)],0,4380000,10*60)
    assert result['status'] == 'infeasible'
    assert result['maximum_extra_cents'] == 500000
    assert len(result['scenarios']) == 3
    for s in result['scenarios']:
        assert s['minutes'] <= 600
        assert s['counts'][1] == 0
        assert s['counts'][0] <= 10
    assert len({tuple(s['counts']) for s in result['scenarios']}) == 3


def test_only_existing_legal_nonzero_combinations_are_returned():
    result = optimize([work(extra=1)],0,999999,60)
    assert len(result['scenarios']) == 1
    assert result['scenarios'][0]['counts'] == [1]
    assert optimize([work(extra=0)],0,999999,60)['scenarios'] == []
