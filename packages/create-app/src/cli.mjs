import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { downloadStarter, listStarts, loadFlavours, UsageError } from './starter.mjs';

const ROWS = ['client', 'server'];
const BASE_TEMPLATE = 'base';
const SHARED_TEMPLATE = 'shared';

const OPTIONS = {
  client: { type: 'string' },
  server: { type: 'string' },
  start: { type: 'string', default: 'hello' },
  ref: { type: 'string' },
  starter: { type: 'string' },
  'no-install': { type: 'boolean', default: false },
};

const USAGE = 'Usage: npm create @vectoragents/app <dir> -- --client <flavour> --server <flavour> [--start <start>] [--ref <ref>] [--starter <path>] [--no-install]';

const DEFAULT_REF = 'main';

const npmInstall = (dir) => {
  const result = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error('npm install failed.');
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

/**
 * Builds the project in a hidden staging directory and moves it into place, so a failed build leaves
 * nothing behind and the same command can run again. An existing empty target stays the same directory
 * (it may be the reader's working directory), so staging sits inside it.
 */
function buildInto(targetDir, build) {
  const exists = existsSync(targetDir);
  if (!exists) mkdirSync(dirname(targetDir), { recursive: true });
  const staging = join(exists ? targetDir : dirname(targetDir), `.${basename(targetDir)}-${randomUUID().slice(0, 8)}`);
  mkdirSync(staging);
  try {
    build(staging);
    if (!exists) {
      renameSync(staging, targetDir);
      return;
    }
    for (const entry of readdirSync(staging)) renameSync(join(staging, entry), join(targetDir, entry));
    rmdirSync(staging);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

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
    if (values.starter === '') throw new UsageError(`--starter needs a path.\n${USAGE}`);
    if (values.ref === '') throw new UsageError(`--ref needs a git ref.\n${USAGE}`);
    if (values.starter !== undefined && values.ref !== undefined) throw new UsageError(`--starter and --ref cannot be combined: --starter reads a local checkout.\n${USAGE}`);
    if (positionals.length > 1) throw new UsageError(`Expected one project directory, got ${positionals.length}: ${positionals.join(' ')}\n${USAGE}`);

    let starterDir;
    let source;
    if (values.starter) {
      starterDir = resolve(io.cwd, values.starter);
      source = starterDir;
    } else {
      const ref = values.ref ?? DEFAULT_REF;
      ({ dir: starterDir, cleanup } = await downloadStarter(ref));
      source = `ref "${ref}"`;
    }
    if (!existsSync(join(starterDir, 'templates'))) {
      throw new UsageError(`The starter at ${source} has no templates/ directory. Pass --ref with a ref that has it, or --starter with a checkout that does.`);
    }

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
    buildInto(targetDir, (dir) => {
      copyTemplate(join(templates, BASE_TEMPLATE), dir);
      if (chosen.some((f) => f.needsShared)) copyTemplate(join(templates, SHARED_TEMPLATE), dir);
      for (const flavour of chosen) copyTemplate(flavour.dir, dir);
      if (values.start !== 'hello') cpSync(join(starterDir, 'overlays', values.start), dir, { recursive: true });
    });

    if (!values['no-install']) {
      try {
        io.install(targetDir);
      } catch (error) {
        throw new Error(`${error.message} The project is in ${targetDir}; fix the error and run \`npm install\` in it.`);
      }
    }
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
