#!/usr/bin/env node
import {
  defineCommand,
  fail,
  ok,
  type CommandDefinition,
  type CommandResult,
  type HelpRecord,
  type ToolIO
} from 'agenttk';
import type { MicrocanvasRecord } from './contracts.js';
import { runRender } from './commands/render.js';
import { runShowFromArgs } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdateFromArgs } from './commands/update.js';
import { runVerify } from './commands/verify.js';
import { renderCommandResult, renderToolHelp, resolvePresentationMode } from './presentation.js';

const tool = {
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
      usage: 'microcanvas show <path|surfaceId> [--native] [--json]',
      examples: ['microcanvas show README.md', 'microcanvas show <surface-id> --native --json'],
      handler: async ({ rawArgs }) => runShowFromArgs(rawArgs)
    }),
    defineCommand({
      name: 'update',
      description: 'Update the active surface from a supported source file.',
      usage: 'microcanvas update <path> [--native] [--json]',
      examples: ['microcanvas update README.md', 'microcanvas update README.md --native --json'],
      handler: async ({ rawArgs }) => runUpdateFromArgs(rawArgs)
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
} satisfies {
  name: string;
  description: string;
  commands: CommandDefinition<unknown, MicrocanvasRecord>[];
};

type CliResult = CommandResult<MicrocanvasRecord | HelpRecord>;

function isHelpFlag(value: string | undefined): boolean {
  return value === 'help' || value === '--help' || value === '-h';
}

function findCommand(commands: CommandDefinition<unknown, MicrocanvasRecord>[], name: string | undefined) {
  if (!name) {
    return undefined;
  }

  return commands.find((command) => command.name === name || command.aliases?.includes(name));
}

function createContext(argv: string[], io?: ToolIO) {
  return {
    toolName: tool.name,
    json: argv.includes('--json'),
    stdout: io?.stdout ?? process.stdout,
    stderr: io?.stderr ?? process.stderr
  };
}

function createToolHelpRecord(): Extract<HelpRecord, { kind: 'tool' }> {
  return {
    kind: 'tool',
    name: tool.name,
    description: tool.description,
    commands: tool.commands.map((command) => ({
      name: command.name,
      description: command.description,
      aliases: command.aliases,
      risk: command.risk
    }))
  };
}

function createCommandHelpRecord(
  command: CommandDefinition<unknown, MicrocanvasRecord>
): Extract<HelpRecord, { kind: 'command' }> {
  return {
    kind: 'command',
    toolName: tool.name,
    name: command.name,
    description: command.description,
    aliases: command.aliases,
    usage: command.usage,
    examples: command.examples,
    risk: command.risk
  };
}

function unknownCommandResult(commandName?: string): Extract<CliResult, { ok: false }> {
  return fail({
    error: {
      code: 'UNKNOWN_COMMAND',
      message: commandName ? `Unknown command: ${commandName}` : `No command provided for ${tool.name}`
    }
  });
}

function writeJsonResult(result: CliResult, stdout: NodeJS.WritableStream): void {
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function emitHelp(record: HelpRecord, ctx: ReturnType<typeof createContext>): CliResult {
  const result = ok({
    type: 'help',
    record
  });

  if (ctx.json) {
    writeJsonResult(result, ctx.stdout);
    return result;
  }

  ctx.stdout.write(`${renderToolHelp(record, resolvePresentationMode(ctx.stdout as NodeJS.WriteStream))}\n`);
  return result;
}

function emitResult(
  result: CommandResult<MicrocanvasRecord>,
  ctx: ReturnType<typeof createContext>
): CommandResult<MicrocanvasRecord> {
  if (ctx.json) {
    writeJsonResult(result, ctx.stdout);
    return result;
  }

  const stream = result.ok ? ctx.stdout : ctx.stderr;
  stream.write(`${renderCommandResult(result, resolvePresentationMode(stream as NodeJS.WriteStream))}\n`);
  return result;
}

async function dispatch(argv: string[], io?: ToolIO): Promise<CliResult> {
  const filteredArgs = argv.filter((arg) => arg !== '--json');
  const [commandName, ...rawArgs] = filteredArgs;
  const ctx = createContext(argv, io);

  if (!commandName || isHelpFlag(commandName)) {
    return emitHelp(createToolHelpRecord(), ctx);
  }

  const command = findCommand(tool.commands, commandName);
  if (!command) {
    return emitResult(unknownCommandResult(commandName), ctx);
  }

  if (rawArgs.some((arg) => isHelpFlag(arg))) {
    return emitHelp(createCommandHelpRecord(command), ctx);
  }

  const result = await command.handler({ input: undefined, rawArgs, ctx });
  return emitResult(result, ctx);
}

async function main(): Promise<void> {
  await dispatch(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr
  });
}

void main();
