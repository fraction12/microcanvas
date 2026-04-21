#!/usr/bin/env node
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runStatus } from './commands/status.js';
import { printResult } from '../core/results.js';

const command = process.argv[2];

switch (command) {
  case 'status':
    runStatus();
    break;
  case 'render':
    runRender();
    break;
  case 'show':
    runShow();
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
