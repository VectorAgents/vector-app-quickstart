import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { downloadStarter, listStarts, loadFlavours, UsageError } from './starter.mjs';

const ROWS = ['client', 'server'];
const BASE_TEMPLATE = 'base';
const SHARED_TEMPLATE = 'shared';

const OPTIONS = {
  client: { type: 'string' },
  server: { type: 'string' },
  start: { type: 'string', default: 'hello' },
  ref: { type: 'string', default: 'main' },
  starter: { type: 'string' },
  'no-install': { type: 'boolean', default: false },
};

const USAGE = 'Usage: npm create @vectoragents/app <dir> -- --client <flavour> --server <flavour> [--start <start>] [--ref <ref>] [--starter <path>] [--no-install]';

const npmInstall = (dir) => {
  const result = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error('npm install failed. The project is scaffolded; fix the error and run it again.');
};

const listFlavours = (flavours) => flavours.map((f) => `  ${f.name}  ${f.label}${f.default ? ' (default)' : ''}`).join('\n');

/** Reads lines one at a time, so answers typed before the question is asked are not lost. */
function makePrompter(io) {
  let reader;
  let lines;
  const ask = async (question) => {
    reader ??= createInterface({ input: io.stdin });
    lines ??= reader[Symbol.asyncIterator]();
    io.stdout.write(question);
    const { value, done } = await lines.next();
    if (done) throw new UsageError('No answer given.');
    return value.trim();
  };
  return { ask, close: () => reader?.close() };
}

async function chooseFlavour(row, flavours, flag, io, ask) {
  if (flag !== undefined) {
    if (flavours.some((f) => f.name === flag)) return flag;
    throw new UsageError(`Unknown ${row} "${flag}". Valid ${row} flavours:\n${listFlavours(flavours)}`);
  }
  if (!io.isTTY) throw new UsageError(`Missing --${row}. Valid ${row} flavours:\n${listFlavours(flavours)}`);
  const fallback = flavours.find((f) => f.default)?.name;
  io.stdout.write(`${row}:\n${listFlavours(flavours)}\n`);
  for (;;) {
    const answer = await ask(`Choose a ${row}${fallback ? ` [${fallback}]` : ''}: `);
    const picked = answer || fallback;
    if (flavours.some((f) => f.name === picked)) return picked;
    io.stdout.write(`"${answer}" is not a ${row} flavour.\n`);
  }
}

function isEmptyDir(dir) {
  return !existsSync(dir) || readdirSync(dir).length === 0;
}

function copyTemplate(templateDir, targetDir) {
  cpSync(templateDir, targetDir, { recursive: true, filter: (source) => source !== join(templateDir, 'flavour.json') });
}

/** Runs the CLI and returns the process exit code. */
export async function run(argv, io = {}) {
  io = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, isTTY: process.stdin.isTTY, install: npmInstall, cwd: process.cwd(), ...io };
  let cleanup;
  const prompter = makePrompter(io);
  const { ask } = prompter;
  try {
    let args;
    try {
      args = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    } catch (error) {
      throw new UsageError(`${error.message}\n${USAGE}`);
    }
    const { values, positionals } = args;

    let starterDir = values.starter && resolve(io.cwd, values.starter);
    if (!starterDir) ({ dir: starterDir, cleanup } = await downloadStarter(values.ref));

    const flavours = loadFlavours(starterDir);
    const starts = listStarts(starterDir);
    if (!starts.includes(values.start)) {
      throw new UsageError(`Unknown start "${values.start}". Valid starts: ${starts.join(', ')}`);
    }

    let target = positionals[0];
    if (target === undefined) {
      if (!io.isTTY) throw new UsageError(`Missing project directory.\n${USAGE}`);
      target = (await ask('Project name [hello-app]: ')) || 'hello-app';
    }
    const targetDir = resolve(io.cwd, target);
    if (!isEmptyDir(targetDir)) throw new UsageError(`${targetDir} is not empty.`);

    const chosen = [];
    for (const row of ROWS) {
      const rowFlavours = flavours.filter((f) => f.row === row);
      if (rowFlavours.length === 0) throw new Error(`The starter has no ${row} flavour.`);
      const name = await chooseFlavour(row, rowFlavours, values[row], io, ask);
      chosen.push(rowFlavours.find((f) => f.name === name));
    }

    const templates = join(starterDir, 'templates');
    copyTemplate(join(templates, BASE_TEMPLATE), targetDir);
    if (chosen.some((f) => f.needsShared)) copyTemplate(join(templates, SHARED_TEMPLATE), targetDir);
    for (const flavour of chosen) copyTemplate(flavour.dir, targetDir);
    if (values.start !== 'hello') cpSync(join(starterDir, 'overlays', values.start), targetDir, { recursive: true });

    if (!values['no-install']) io.install(targetDir);
    io.stdout.write(`Created ${basename(targetDir)}. Run \`npm run dev\` inside it.\n`);
    return 0;
  } catch (error) {
    io.stderr.write(`${error.message}\n`);
    return 1;
  } finally {
    prompter.close();
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
}
