import pytest

@pytest.fixture(autouse=True)
def isolated_database(tmp_path,monkeypatch,request):
    monkeypatch.setenv('DATABASE_PATH',str(tmp_path/'test.sqlite3'))
    monkeypatch.setenv('SESSION_COOKIE_SECURE','false')
    monkeypatch.setenv('APP_ALLOWED_ORIGINS','http://localhost:3000,http://127.0.0.1:3000')
    if request.module.__name__.endswith('test_engine'):
        response=request.module.client.post('/api/auth/register',json={'username':'engine-tests','password':'Engine-test-password-123'})
        assert response.status_code==201
