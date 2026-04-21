#!/usr/bin/env node
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runStatus } from './commands/status.js';
import { printResult } from '../core/results.js';

const command = process.argv[2];
const arg = process.argv[3];

async function main(): Promise<void> {
  switch (command) {
    case 'status':
      runStatus();
      break;
    case 'render':
      await runRender(arg);
      break;
    case 'show':
      await runShow(arg);
      break;
    default:
      printResult({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'expected one of: status, render, show',
        surfaceId: null,
        viewer: { open: false },
        lock: { held: false },
        artifacts: {}
      });
  }
}

void main();
