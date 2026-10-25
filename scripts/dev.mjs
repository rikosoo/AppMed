import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Crie o ambiente Python antes: python -m venv .venv. Consulte o README para instalar as dependências.');
  process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function start(executable, args, cwd) {
  const child = spawn(executable, args, { cwd, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) stop(code ?? (signal ? 1 : 0)); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
start(python, ['-m', 'uvicorn', 'main:app', '--app-dir', 'services/api', '--host', '127.0.0.1', '--port', '8000'], root);
start(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '0.0.0.0'], path.join(root, 'apps/web'));
