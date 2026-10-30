import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import { pythonPath, pythonCandidates, nextEntrypoint, apiMatches } from './dev-support.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.includes('--web-only') ? 'web' : process.argv.includes('--api-only') ? 'api' : 'all';
const children = [];
let stopping = false;
function fail(message) { console.error(`\n[Axterix Med] ${message}\n`); process.exit(1); }
function command(executable, args, options = {}) {
  return spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true, ...options });
}
function preparePython() {
  const python = pythonPath(root);
  if (!existsSync(python)) {
    const candidate = pythonCandidates().find(([exe,...prefix]) => {
      const result = command(exe,[...prefix,'-c','import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)']);
      return result.status === 0;
    });
    if (!candidate) fail('Instale Python 3.12 ou superior, reabra o terminal e execute npm run dev novamente. No Windows, o instalador oficial oferece a opção de adicionar Python ao PATH.');
    if (existsSync(path.join(root,'.venv'))) fail('A pasta .venv existe, mas o Python dela não foi encontrado. Recrie o ambiente com python -m venv .venv e tente novamente.');
    console.log('[Axterix Med] Criando o ambiente Python local…');
    const [exe,...prefix] = candidate;
    if (command(exe,[...prefix,'-m','venv','.venv'],{stdio:'inherit',timeout:120000}).status !== 0) fail('Não foi possível criar .venv. Confira a instalação do Python e tente novamente.');
  }
  const probe = command(python,['-c','import uvicorn, fastapi; from engine import ENGINE_VERSION'],{cwd:path.join(root,'services/api')});
  if (probe.status !== 0) {
    if (probe.error) fail('O Python em .venv não pode ser executado. Recrie o ambiente nesta máquina; ambientes virtuais copiados de outra pasta ou sistema podem não funcionar.');
    console.log('[Axterix Med] Instalando as dependências da API…');
    const installed = command(python,['-m','pip','install','--require-hashes','-r','services/api/requirements.lock'],{stdio:'inherit',timeout:600000});
    if (installed.status !== 0) fail('A instalação da API falhou. Confira o erro acima e a conexão de rede. Depois execute npm run dev novamente.');
    const retry = command(python,['-c','import uvicorn, fastapi; from engine import ENGINE_VERSION'],{cwd:path.join(root,'services/api')});
    if (retry.status !== 0) fail('A API ainda não consegue carregar suas dependências. Confira o README para reinstalar o ambiente Python.');
  }
  return python;
}
function portBusy(port) {
  return new Promise(resolve=>{
    const socket=net.createConnection({host:'127.0.0.1',port});
    socket.once('connect',()=>{socket.destroy();resolve(true);});
    socket.once('error',()=>{socket.destroy();resolve(false);});
    socket.setTimeout(1500,()=>{socket.destroy();resolve(true);});
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function start(executable, args, cwd, name) {
  const child = spawn(executable, args, { cwd, stdio:'inherit', windowsHide:true });
  children.push(child);
  child.on('error', error=>{console.error(`[Axterix Med] Não foi possível iniciar ${name}: ${error.message}`);stop(1);});
  child.on('exit', (code,signal)=>{if(!stopping){if(code)console.error(`[Axterix Med] ${name} encerrou com erro. Confira as mensagens acima.`);stop(code??(signal?1:0));}});
}
process.on('SIGINT',()=>stop());
process.on('SIGTERM',()=>stop());

if (mode !== 'api' && await portBusy(3000)) fail('A porta 3000 já está em uso. Pare o frontend antigo com Ctrl+C no terminal dele e execute npm run dev novamente.');
let reuseApi = false;
if (mode !== 'web' && await portBusy(8000)) {
  const version=readFileSync(path.join(root,'services/api/engine.py'),'utf8').match(/ENGINE_VERSION = '([^']+)'/)?.[1];
  try {
    const health=await fetch('http://127.0.0.1:8000/api/health',{signal:AbortSignal.timeout(2000)});
    reuseApi=health.ok&&apiMatches(await health.json(),version);
  } catch { /* The port belongs to an incompatible service. */ }
  if(!reuseApi)fail('A porta 8000 está ocupada por outro serviço ou uma versão antiga da API. Pare esse servidor com Ctrl+C antes de iniciar novamente.');
  console.log('[Axterix Med] API compatível já está na porta 8000; usando esse serviço sem encerrá-lo.');
}
let next;
if(mode!=='api'){
  try{next=nextEntrypoint(root);}catch{fail('As dependências da interface não foram encontradas. Execute npm ci na pasta principal do projeto.');}
}
if(mode!=='web'&&!reuseApi){
  const python=preparePython();
  start(python,['-m','uvicorn','main:app','--app-dir','services/api','--host','127.0.0.1','--port','8000'],root,'API');
}
if(mode!=='api')start(process.execPath,[next,'dev','--hostname','0.0.0.0','--port','3000'],path.join(root,'apps/web'),'Interface');
console.log(mode==='web'?'[Axterix Med] Somente interface. Para calcular, mantenha a API em execução.':'[Axterix Med] API de cálculo: porta 8000.');
if(mode!=='api')console.log('[Axterix Med] Interface: http://localhost:3000 — Ctrl+C encerra os serviços iniciados por este comando.');
