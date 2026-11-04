import { spawn } from 'node:child_process';
import { presetEnv } from './env-preset.mjs';

const mode = process.argv[2];
// tsx watch and vite read the environment once at start, so it is fixed here.
const env = presetEnv(mode, process.env);

const children = ['server', 'client'].map((name) =>
  spawn('npm', ['run', 'dev', '--workspace', `@hello-app/${name}`], { env, stdio: 'inherit', detached: true }),
);

function stop(code) {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // The group already exited.
    }
  }
  process.exit(code);
}

for (const child of children) child.on('exit', (code) => stop(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
