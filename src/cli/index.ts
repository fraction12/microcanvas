#!/usr/bin/env node
import { createTool, defineCommand } from 'agenttk';
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runVerify } from './commands/verify.js';

const tool = createTool({
  name: 'microcanvas',
  description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
  commands: [
    defineCommand({
      name: 'render',
      description: 'Render a supported source file into staging.',
      usage: 'microcanvas render <path> [--json]',
      examples: ['microcanvas render README.md', 'microcanvas render README.md --json'],
      handler: async ({ rawArgs }) => runRender(rawArgs[0])
    }),
    defineCommand({
      name: 'show',
      description: 'Activate a staged surface or render and show a source file.',
      usage: 'microcanvas show <path|surfaceId> [--json]',
      examples: ['microcanvas show README.md', 'microcanvas show <surface-id> --json'],
      handler: async ({ rawArgs }) => runShow(rawArgs[0])
    }),
    defineCommand({
      name: 'update',
      description: 'Update the active surface from a supported source file.',
      usage: 'microcanvas update <path> [--json]',
      examples: ['microcanvas update README.md', 'microcanvas update README.md --json'],
      handler: async ({ rawArgs }) => runUpdate(rawArgs[0])
    }),
    defineCommand({
      name: 'snapshot',
      description: 'Capture a real PNG snapshot from the native viewer.',
      usage: 'microcanvas snapshot [--json]',
      examples: ['microcanvas snapshot', 'microcanvas snapshot --json'],
      handler: async () => runSnapshot()
    }),
    defineCommand({
      name: 'verify',
      description: 'Verify active surface files and viewer runtime state.',
      usage: 'microcanvas verify [--json]',
      examples: ['microcanvas verify', 'microcanvas verify --json'],
      handler: async () => runVerify()
    }),
    defineCommand({
      name: 'status',
      description: 'Report runtime, lock, and viewer state.',
      usage: 'microcanvas status [--json]',
      examples: ['microcanvas status', 'microcanvas status --json'],
      handler: async () => runStatus()
    })
  ]
});

async function main(): Promise<void> {
  await tool.run(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr
  });
}

void main();
