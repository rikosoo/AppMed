import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import pytest

spec=importlib.util.spec_from_file_location('proxy_setup',Path(__file__).resolve().parents[3]/'scripts'/'configure-proxy-token.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)

def test_proxy_configuration_preserves_values_permissions_and_is_idempotent(tmp_path):
    path=tmp_path/'.env';original='APP_DOMAIN=app.example.com\nSMTP_PASSWORD="fixture-secret#value"\nINTERNAL_PROXY_TOKEN=\n';path.write_text(original)
    assert setup.configure(path)
    configured=path.read_text();token=re.search(r'^INTERNAL_PROXY_TOKEN=(.+)$',configured,re.M)[1]
    assert re.fullmatch('[A-Za-z0-9_-]{64}',token)
    assert 'SMTP_PASSWORD="fixture-secret#value"\n' in configured
    assert path.stat().st_mode&0o777==0o600
    assert not setup.configure(path) and path.read_text()==configured
    result=subprocess.run([sys.executable,str(spec.origin),str(path)],capture_output=True,text=True)
    assert result.returncode==0 and token not in result.stdout+result.stderr and 'fixture-secret' not in result.stdout+result.stderr

def test_proxy_configuration_rejects_duplicates_symlinks_and_weak_values(tmp_path):
    path=tmp_path/'.env'
    for text in ['INTERNAL_PROXY_TOKEN=short\n','INTERNAL_PROXY_TOKEN=\nINTERNAL_PROXY_TOKEN=\n']:
        path.write_text(text)
        with pytest.raises(ValueError):setup.configure(path)
        assert path.read_text()==text
    alias=tmp_path/'alias';alias.symlink_to(path)
    with pytest.raises(ValueError):setup.configure(alias)
