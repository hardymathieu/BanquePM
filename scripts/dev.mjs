// npm run dev: the Worker in wrangler dev (API, port 8787) and Vite (UI, port 5173, proxies /api).
import { spawn } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const children = [run('npx', ['wrangler', 'dev', '--port', '8787']), run('npx', ['vite', '--port', '5173'])];
const stop = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', stop));
