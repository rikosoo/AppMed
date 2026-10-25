import path from 'node:path';
import { createRequire } from 'node:module';
export const pythonPath = (root, platform = process.platform) => path.join(root, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const pythonCandidates = (platform = process.platform) => platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];
export const nextEntrypoint = root => createRequire(path.join(root, 'apps/web/package.json')).resolve('next/dist/bin/next');
export function apiMatches(value, version) { return value?.status === 'ok' && value?.engine === version; }
