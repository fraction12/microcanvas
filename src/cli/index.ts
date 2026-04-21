#!/usr/bin/env node
import { createTool, defineCommand, ok } from 'agenttk';
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runVerify } from './commands/verify.js';
import { printResult } from '../core/results.js';

const tool = createTool({
  name: 'microcanvas',
  description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
  commands: [
    defineCommand({
      name: 'render',
      description: 'Render a supported source file into staging.',
      async handler() {
        return ok({ type: 'help' });
      }
    }),
    defineCommand({
      name: 'show',
      description: 'Activate a staged surface or render and show a source file.',
      async handler() {
        return ok({ type: 'help' });
      }
    }),
    defineCommand({
      name: 'update',
      description: 'Update the active surface from a supported source file.',
      async handler() {
        return ok({ type: 'help' });
      }
    }),
    defineCommand({
      name: 'snapshot',
      description: 'Capture a real PNG snapshot from the native viewer.',
      async handler() {
        return ok({ type: 'help' });
      }
    }),
    defineCommand({
      name: 'verify',
      description: 'Verify active surface files and viewer runtime state.',
      async handler() {
        return ok({ type: 'help' });
      }
    }),
    defineCommand({
      name: 'status',
      description: 'Report runtime, lock, and viewer state.',
      async handler() {
        return ok({ type: 'help' });
      }
    })
  ]
});

async function dispatchJson(command: string | undefined, arg: string | undefined): Promise<void> {
  switch (command) {
    case 'render':
      await runRender(arg);
      break;
    case 'show':
      await runShow(arg);
      break;
    case 'update':
      await runUpdate(arg);
      break;
    case 'snapshot':
      await runSnapshot();
      break;
    case 'verify':
      runVerify();
      break;
    case 'status':
      runStatus();
      break;
    default:
      printResult({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'expected one of: status, render, show, update, verify, snapshot',
        surfaceId: null,
        viewer: { open: false },
        lock: { held: false },
        artifacts: {}
      });
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  const filtered = argv.filter((arg) => arg !== '--json');
  const command = filtered[0];
  const arg = filtered[1];

  if (wantsJson) {
    await dispatchJson(command, arg);
    return;
  }

  if (!command || command === '-h' || command === '--help') {
    await tool.run(argv, {
      stdout: process.stdout,
      stderr: process.stderr
    });
    return;
  }

  await dispatchJson(command, arg);
}

void main();
