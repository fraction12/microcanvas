#!/usr/bin/env node
import { createTool, defineCommand, ok } from 'agenttk';
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runVerify } from './commands/verify.js';
import { printHumanResult, printResult } from '../core/results.js';
import type { CommandResult } from '../core/results.js';

const helpText = `microcanvas
A lightweight, agent-friendly canvas runtime and native viewer.

Usage:
  microcanvas <command> [argument]
  microcanvas <command> --help
  microcanvas <command> [argument] --json

Commands:
  render <path>          Render a supported source file into staging.
  show <path|surfaceId>  Activate a staged surface or render and show a source file.
  update <path>          Update the active surface from a supported source file.
  snapshot               Capture a real PNG snapshot from the native viewer.
  verify                 Verify active surface files and viewer runtime state.
  status                 Report runtime, lock, and viewer state.

Examples:
  microcanvas render README.md
  microcanvas show README.md
  microcanvas update README.md
  microcanvas snapshot
  microcanvas verify
  microcanvas status
  microcanvas show README.md --json`;

const commandHelp: Record<string, string> = {
  render: 'Usage: microcanvas render <path> [--json]\nRenders a supported source file into staging.',
  show: 'Usage: microcanvas show <path|surfaceId> [--json]\nActivates a staged surface or renders and shows a source file.',
  update: 'Usage: microcanvas update <path> [--json]\nUpdates the active surface from a supported source file.',
  snapshot: 'Usage: microcanvas snapshot [--json]\nCaptures a real PNG snapshot from the native viewer.',
  verify: 'Usage: microcanvas verify [--json]\nVerifies active surface files and viewer runtime state.',
  status: 'Usage: microcanvas status [--json]\nReports runtime, lock, and viewer state.'
};

const tool = createTool({
  name: 'microcanvas',
  description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
  commands: [
    defineCommand({ name: 'render', description: 'Render a supported source file into staging.', async handler() { return ok({ type: 'help' }); } }),
    defineCommand({ name: 'show', description: 'Activate a staged surface or render and show a source file.', async handler() { return ok({ type: 'help' }); } }),
    defineCommand({ name: 'update', description: 'Update the active surface from a supported source file.', async handler() { return ok({ type: 'help' }); } }),
    defineCommand({ name: 'snapshot', description: 'Capture a real PNG snapshot from the native viewer.', async handler() { return ok({ type: 'help' }); } }),
    defineCommand({ name: 'verify', description: 'Verify active surface files and viewer runtime state.', async handler() { return ok({ type: 'help' }); } }),
    defineCommand({ name: 'status', description: 'Report runtime, lock, and viewer state.', async handler() { return ok({ type: 'help' }); } })
  ]
});

function emit(result: CommandResult, json: boolean): void {
  if (json) {
    printResult(result);
    return;
  }
  printHumanResult(result);
}

async function dispatch(command: string | undefined, arg: string | undefined, json: boolean): Promise<void> {
  const capture = (fn: typeof runRender | typeof runShow | typeof runUpdate | typeof runSnapshot | typeof runVerify | typeof runStatus) => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let buffer = '';
    (process.stdout.write as unknown) = ((chunk: string | Uint8Array) => {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      return true;
    }) as typeof process.stdout.write;
    return Promise.resolve(fn(undefined as never))
      .then(() => buffer)
      .finally(() => {
        (process.stdout.write as unknown) = originalWrite;
      });
  };

  switch (command) {
    case 'render': {
      const raw = await capture(() => runRender(arg));
      emit(JSON.parse(raw), json);
      break;
    }
    case 'show': {
      const raw = await capture(() => runShow(arg));
      emit(JSON.parse(raw), json);
      break;
    }
    case 'update': {
      const raw = await capture(() => runUpdate(arg));
      emit(JSON.parse(raw), json);
      break;
    }
    case 'snapshot': {
      const raw = await capture(() => runSnapshot());
      emit(JSON.parse(raw), json);
      break;
    }
    case 'verify': {
      const raw = await capture(() => { runVerify(); return Promise.resolve(); });
      emit(JSON.parse(raw), json);
      break;
    }
    case 'status': {
      const raw = await capture(() => { runStatus(); return Promise.resolve(); });
      emit(JSON.parse(raw), json);
      break;
    }
    default:
      emit({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'expected one of: status, render, show, update, verify, snapshot',
        surfaceId: null,
        viewer: { open: false },
        lock: { held: false },
        artifacts: {}
      }, json);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  const filtered = argv.filter((arg) => arg !== '--json');
  const command = filtered[0];
  const arg = filtered[1];
  const wantsHelp = !command || command === '-h' || command === '--help';
  const commandHelpRequested = Boolean(command && (arg === '--help' || arg === '-h'));

  if (wantsHelp) {
    process.stdout.write(`${helpText}\n`);
    return;
  }

  if (commandHelpRequested) {
    process.stdout.write(`${commandHelp[command] ?? helpText}\n`);
    return;
  }

  if (!wantsJson && !['render', 'show', 'update', 'snapshot', 'verify', 'status'].includes(command)) {
    await tool.run(argv, {
      stdout: process.stdout,
      stderr: process.stderr
    });
    return;
  }

  await dispatch(command, arg, wantsJson);
}

void main();
