#!/usr/bin/env node
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runVerify } from './commands/verify.js';
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
    case 'update':
      await runUpdate(arg);
      break;
    case 'verify':
      runVerify();
      break;
    case 'snapshot':
      runSnapshot();
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

void main();
