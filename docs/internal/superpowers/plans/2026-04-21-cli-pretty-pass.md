# CLI Pretty Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all Microcanvas human-mode CLI output a lightweight on-brand presentation pass while keeping `--json` behavior unchanged.

**Architecture:** Add one shared CLI presentation module that knows how to render Microcanvas help, success, warning, and failure output in plain or pretty mode. Replace `createTool().run()` in `src/cli/index.ts` with a tiny local dispatcher so Microcanvas can keep AgentTK result contracts while taking control of human-mode rendering.

**Tech Stack:** TypeScript, AgentTK result types/helpers, Node.js streams, `picocolors`, `node:test`

---

## File Map

- Create: `src/cli/presentation.ts`
  - Banner-inspired palette tokens
  - TTY/plain mode selection
  - Shared help renderer
  - Shared success/failure/warning renderer for `MicrocanvasRecord`

- Modify: `src/cli/index.ts`
  - Keep command definitions
  - Replace `tool.run(...)` usage with a tiny local dispatcher
  - Route help, unknown-command, and command results through the new presentation layer

- Modify: `package.json`
  - Add the minimal presentation dependency

- Modify: `package-lock.json`
  - Capture the dependency install

- Create: `test/cli-presentation.test.mjs`
  - Unit tests for pretty/plain rendering and mode selection

- Modify: `test/cli.test.mjs`
  - Keep JSON contract coverage
  - Add human-output integration assertions for help and status-style output

### Task 1: Build The Shared CLI Presentation Module

**Files:**
- Create: `src/cli/presentation.ts`
- Create: `test/cli-presentation.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing presentation tests**

Create `test/cli-presentation.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCommandResult, renderToolHelp, resolvePresentationMode } from '../dist/cli/presentation.js';

test('resolvePresentationMode prefers pretty for interactive terminals and plain otherwise', () => {
  assert.equal(resolvePresentationMode({ isTTY: true }, { NO_COLOR: '' }), 'pretty');
  assert.equal(resolvePresentationMode({ isTTY: false }, { NO_COLOR: '' }), 'plain');
  assert.equal(resolvePresentationMode({ isTTY: true }, { NO_COLOR: '1' }), 'plain');
});

test('renderCommandResult formats Microcanvas success output into compact readable sections', () => {
  const text = renderCommandResult({
    ok: true,
    type: 'snapshot',
    destination: 'runtime',
    verificationStatus: 'unverified',
    nextAction: 'verify_state',
    record: {
      message: 'snapshot captured, but newer content was not ready and the viewer held the last good surface',
      surfaceId: 'surface-123',
      viewer: { mode: 'native', open: true, canVerify: true },
      lock: { held: false },
      artifacts: {
        primary: '/tmp/runtime/active/index.html',
        snapshot: '/tmp/runtime/snapshots/surface-123.png'
      }
    },
    warnings: ['Snapshot captured from held last good content while newer content was not ready.']
  }, { mode: 'pretty', color: false });

  assert.match(text, /OK\\s+Snapshot/i);
  assert.match(text, /surface-123/);
  assert.match(text, /viewer/i);
  assert.match(text, /native/i);
  assert.match(text, /held last good surface/i);
  assert.match(text, /Snapshot captured from held last good content/i);
});

test('renderCommandResult formats failures with code, reason, and next action', () => {
  const text = renderCommandResult({
    ok: false,
    type: 'verify',
    classification: 'unknown',
    retryable: true,
    nextAction: 'verify_state',
    error: {
      code: 'VERIFY_FAILED',
      message: 'viewer is open but not yet reporting the active surface'
    }
  }, { mode: 'pretty', color: false });

  assert.match(text, /ERR\\s+Verify failed/i);
  assert.match(text, /VERIFY_FAILED/);
  assert.match(text, /viewer is open but not yet reporting the active surface/i);
  assert.match(text, /verify_state/i);
});

test('renderToolHelp includes product framing, commands, and a quick-start section', () => {
  const text = renderToolHelp({
    name: 'microcanvas',
    description: 'A lightweight, reliable canvas runtime and viewer for AI coding tools.',
    commands: [
      { name: 'render', description: 'Render a supported source file into staging.' },
      { name: 'show', description: 'Activate a staged surface or render and show a source file.' },
      { name: 'update', description: 'Update the active surface from a supported source file.' },
      { name: 'snapshot', description: 'Capture a real PNG snapshot from the native viewer.' },
      { name: 'verify', description: 'Verify active surface files and viewer runtime state.' },
      { name: 'status', description: 'Report runtime, lock, and viewer state.' }
    ]
  }, { mode: 'plain', color: false });

  assert.match(text, /microcanvas/i);
  assert.match(text, /tiny stagehand for AI tools/i);
  assert.match(text, /Try first:/i);
  assert.match(text, /microcanvas show README\\.md/i);
  assert.match(text, /render/i);
  assert.match(text, /status/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm run build && node --test test/cli-presentation.test.mjs
```

Expected: FAIL because `dist/cli/presentation.js` does not exist yet.

- [ ] **Step 3: Add the minimal dependency and implement the presentation module**

Install the dependency:

```bash
npm install picocolors
```

Update `src/cli/presentation.ts`:

```ts
import pc, { createColors } from 'picocolors';
import type { CommandFailure, CommandSuccess, ToolDefinition } from 'agenttk';
import type { MicrocanvasRecord } from './contracts.js';

export type PresentationMode = 'plain' | 'pretty';

export interface PresentationOptions {
  mode: PresentationMode;
  color: boolean;
}

export function resolvePresentationMode(
  stream: { isTTY?: boolean } | undefined,
  env: NodeJS.ProcessEnv = process.env
): PresentationMode {
  if (env.NO_COLOR === '1') return 'plain';
  return stream?.isTTY ? 'pretty' : 'plain';
}

function palette(enabled: boolean) {
  return createColors(enabled);
}

function headlineLabel(type: string, ok: boolean): string {
  if (!ok) return `${humanize(type)} failed`;
  switch (type) {
    case 'render': return 'Surface staged';
    case 'show': return 'Surface live';
    case 'update': return 'Surface refreshed';
    case 'snapshot': return 'Snapshot';
    case 'verify': return 'Verified';
    case 'status': return 'Runtime status';
    default: return humanize(type);
  }
}

function humanize(value: string | undefined): string {
  if (!value) return 'Result';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\\b\\w/g, (match) => match.toUpperCase());
}

function formatRow(label: string, value: string, colors: ReturnType<typeof palette>, pretty: boolean): string {
  if (!pretty) return `${label}: ${value}`;
  return `${colors.dim(label.padEnd(13))} ${value}`;
}

function collectRecordRows(record: MicrocanvasRecord): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (record.message) rows.push(['Message', record.message]);
  if (record.surfaceId) rows.push(['Surface', record.surfaceId]);
  if (record.viewer) {
    rows.push([
      'Viewer',
      `${record.viewer.mode} • open ${record.viewer.open ? 'yes' : 'no'} • verify ${record.viewer.canVerify ? 'on' : 'off'}`
    ]);
  }
  if (record.lock) {
    rows.push(['Lock', record.lock.held ? `held${record.lock.reason ? ` • ${record.lock.reason}` : ''}` : 'clear']);
  }
  if (record.artifacts?.primary) rows.push(['Primary', record.artifacts.primary]);
  if (record.artifacts?.snapshot) rows.push(['Snapshot', record.artifacts.snapshot]);
  return rows;
}

export function renderCommandResult(
  result: CommandSuccess<MicrocanvasRecord> | CommandFailure,
  options: PresentationOptions
): string {
  const colors = palette(options.color);
  const pretty = options.mode === 'pretty';

  if (!result.ok) {
    const badge = pretty ? colors.bgRed(colors.black(' ERR ')) : 'ERR';
    const lines = [
      `${badge} ${pretty ? colors.bold(headlineLabel(result.type ?? 'result', false)) : headlineLabel(result.type ?? 'result', false)}`,
      formatRow('Code', result.error.code, colors, pretty),
      formatRow('Reason', result.error.message, colors, pretty)
    ];
    if (result.nextAction) lines.push(formatRow('Next', result.nextAction, colors, pretty));
    if (result.retryable !== undefined) lines.push(formatRow('Retryable', result.retryable ? 'yes' : 'no', colors, pretty));
    return lines.join('\\n');
  }

  const badge = pretty ? colors.bgCyan(colors.black(' OK ')) : 'OK';
  const lines = [
    `${badge} ${pretty ? colors.bold(headlineLabel(result.type, true)) : headlineLabel(result.type, true)}`
  ];

  if (result.record) {
    for (const [label, value] of collectRecordRows(result.record)) {
      lines.push(formatRow(label, value, colors, pretty));
    }
  }

  if (result.verificationStatus) {
    lines.push(formatRow('Verification', result.verificationStatus, colors, pretty));
  }

  if (result.nextAction) {
    lines.push(formatRow('Next', result.nextAction, colors, pretty));
  }

  if (result.warnings?.length) {
    const warningBadge = pretty ? colors.bgYellow(colors.black(' WARN ')) : 'WARN';
    for (const warning of result.warnings) {
      lines.push(`${warningBadge} ${warning}`);
    }
  }

  return lines.join('\\n');
}

export function renderToolHelp(definition: Pick<ToolDefinition, 'name' | 'description' | 'commands'>, options: PresentationOptions): string {
  const colors = palette(options.color);
  const pretty = options.mode === 'pretty';
  const lines = [
    pretty ? colors.bold(colors.cyan(definition.name)) : definition.name,
    'A tiny stagehand for AI tools.',
    ''
  ];

  if (definition.description) {
    lines.push(definition.description, '');
  }

  lines.push('Commands:');
  for (const command of definition.commands) {
    lines.push(`- ${command.name.padEnd(8)} ${command.description ?? ''}`);
  }

  lines.push('', 'Try first:', '- microcanvas show README.md', '- microcanvas status', '- microcanvas snapshot --json');
  return lines.join('\\n');
}

export function renderCommandHelp(
  toolName: string,
  command: { name: string; description?: string; usage?: string; examples?: string[] },
  options: PresentationOptions
): string {
  const colors = palette(options.color);
  const pretty = options.mode === 'pretty';
  const lines = [
    pretty ? colors.bold(colors.cyan(`${toolName} ${command.name}`)) : `${toolName} ${command.name}`
  ];
  if (command.description) lines.push(command.description);
  if (command.usage) lines.push('', `Usage: ${command.usage}`);
  if (command.examples?.length) {
    lines.push('', 'Examples:');
    for (const example of command.examples) lines.push(`- ${example}`);
  }
  return lines.join('\\n');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npm run build && node --test test/cli-presentation.test.mjs
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/cli/presentation.ts test/cli-presentation.test.mjs
git commit -m "feat: add cli presentation helpers"
```

### Task 2: Replace AgentTK’s Default Human Renderer With A Tiny Local Dispatcher

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Write the failing integration assertions for help and plain human output**

Update `test/cli.test.mjs` by replacing the existing help test with:

```js
test('human help output is command-aware and product-oriented', async () => {
  const rootHelp = await runCliText(['--help']);
  assert.match(rootHelp.stdout, /microcanvas/i);
  assert.match(rootHelp.stdout, /tiny stagehand for AI tools/i);
  assert.match(rootHelp.stdout, /Try first:/i);
  assert.match(rootHelp.stdout, /microcanvas show README\\.md/i);

  const renderHelp = await runCliText(['render', '--help']);
  assert.match(renderHelp.stdout, /microcanvas render/i);
  assert.match(renderHelp.stdout, /Usage: microcanvas render <path>/);
  assert.match(renderHelp.stdout, /Examples:/);
});

test('human status output stays readable when stdout is not a TTY', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-degraded',
    viewerMode: 'degraded',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-degraded');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>degraded</body></html>');

  const status = await runCliText(['status']);
  assert.match(status.stdout, /Runtime status/i);
  assert.match(status.stdout, /Surface:\\s+surface-degraded/i);
  assert.match(status.stdout, /Viewer:\\s+degraded/i);
  assert.doesNotMatch(status.stdout, /\\u001b\\[/);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:
```bash
npm run build && node --test --test-name-pattern "human help output|human status output" test/cli.test.mjs
```

Expected: FAIL because `src/cli/index.ts` still uses AgentTK’s built-in renderer and does not output the new help/status layout.

- [ ] **Step 3: Implement the custom CLI dispatcher and wire in the presentation helper**

Replace `src/cli/index.ts` with:

```ts
#!/usr/bin/env node
import { fail, ok, defineCommand } from 'agenttk';
import type { CommandDefinition, CommandResult, ToolDefinition } from 'agenttk';
import { runRender } from './commands/render.js';
import { runShow } from './commands/show.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runVerify } from './commands/verify.js';
import { renderCommandHelp, renderCommandResult, renderToolHelp, resolvePresentationMode } from './presentation.js';

const definition: ToolDefinition = {
  name: 'microcanvas',
  description: 'A lightweight, reliable canvas runtime and viewer for AI coding tools.',
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
};

function isHelpFlag(value: string | undefined): boolean {
  return value === 'help' || value === '--help' || value === '-h';
}

function findCommand(name: string | undefined): CommandDefinition | undefined {
  if (!name) return undefined;
  return definition.commands.find((command) => command.name === name || command.aliases?.includes(name));
}

function writeHuman(text: string, okResult: boolean): void {
  const stream = okResult ? process.stdout : process.stderr;
  stream.write(`${text}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const filteredArgs = argv.filter((arg) => arg !== '--json');
  const [commandName, ...rawArgs] = filteredArgs;
  const mode = resolvePresentationMode(process.stdout);
  const presentation = { mode, color: mode === 'pretty' };

  let result: CommandResult;

  if (!commandName || isHelpFlag(commandName)) {
    if (json) {
      result = ok({
        type: 'help',
        record: {
          kind: 'tool',
          name: definition.name,
          description: definition.description,
          commands: definition.commands.map((command) => ({
            name: command.name,
            description: command.description,
            aliases: command.aliases,
            risk: command.risk
          }))
        }
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    writeHuman(renderToolHelp(definition, presentation), true);
    return;
  }

  const command = findCommand(commandName);
  if (!command) {
    result = fail({
      type: 'help',
      error: {
        code: 'UNKNOWN_COMMAND',
        message: `Unknown command: ${commandName}`
      }
    });

    if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    writeHuman(renderCommandResult(result, presentation), false);
    return;
  }

  if (rawArgs.some((arg) => isHelpFlag(arg))) {
    if (json) {
      result = ok({
        type: 'help',
        record: {
          kind: 'command',
          toolName: definition.name,
          name: command.name,
          description: command.description,
          aliases: command.aliases,
          usage: command.usage,
          examples: command.examples,
          risk: command.risk
        }
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    writeHuman(renderCommandHelp(definition.name, command, presentation), true);
    return;
  }

  result = await command.handler({
    input: undefined,
    rawArgs,
    ctx: {
      toolName: definition.name,
      json,
      stdout: process.stdout,
      stderr: process.stderr
    }
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  writeHuman(renderCommandResult(result, presentation), result.ok);
}

void main();
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:
```bash
npm run build && node --test --test-name-pattern "human help output|human status output" test/cli.test.mjs
```

Expected: PASS with both targeted tests green.

- [ ] **Step 5: Commit**

```bash
git add src/cli/index.ts test/cli.test.mjs
git commit -m "feat: wire custom cli output renderer"
```

### Task 3: Tighten Command-Wide Human Output And Finish Regression Coverage

**Files:**
- Modify: `src/cli/presentation.ts`
- Modify: `test/cli.test.mjs`
- Modify: `test/cli-presentation.test.mjs`

- [ ] **Step 1: Add failing assertions for warnings, failures, and verify/status readability**

Append these tests to `test/cli.test.mjs`:

```js
test('human verify failure output stays calm and actionable', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-degraded',
    viewerMode: 'degraded',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-degraded');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>degraded</body></html>');

  let failure;
  try {
    await runCliText(['verify']);
  } catch (error) {
    failure = error;
  }

  assert.ok(failure);
  assert.match(failure.stderr, /ERR\\s+Verify failed/i);
  assert.match(failure.stderr, /VERIFY_FAILED/);
  assert.match(failure.stderr, /degraded display mode/i);
  assert.match(failure.stderr, /verify_state/i);
});

test('human snapshot output surfaces held-last-good warnings clearly', async () => {
  const shown = await runCli(['show', insideFile]);
  const shownRecord = expectSuccess(shown);

  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shownRecord.surfaceId
  });

  const pending = runSnapshot();
  const request = await waitForViewerRequest();

  assert.ok(request);
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    captureState: 'degraded',
    warning: 'Snapshot captured from held last good content while newer content was not ready.',
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  await pending;
  const humanSnapshot = await runCliText(['snapshot']);
  assert.match(humanSnapshot.stdout, /WARN/i);
});
```

Append this test to `test/cli-presentation.test.mjs`:

```js
test('renderCommandResult plain mode stays readable without ansi escapes', () => {
  const text = renderCommandResult({
    ok: true,
    type: 'status',
    verificationStatus: 'not_applicable',
    record: {
      message: 'runtime state loaded',
      surfaceId: 'surface-plain',
      viewer: { mode: 'degraded', open: true, canVerify: false },
      lock: { held: false },
      artifacts: { primary: '/tmp/runtime/active/index.html' }
    }
  }, { mode: 'plain', color: false });

  assert.match(text, /Runtime status/i);
  assert.match(text, /Surface: surface-plain/i);
  assert.match(text, /Viewer: degraded/i);
  assert.doesNotMatch(text, /\\u001b\\[/);
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:
```bash
npm run build && node --test --test-name-pattern "human verify failure|plain mode stays readable" test/cli.test.mjs test/cli-presentation.test.mjs
```

Expected: FAIL because the initial presentation helper will not yet produce the final verify/status wording and warning layout.

- [ ] **Step 3: Tighten the shared renderer so every command benefits without per-command snowflake code**

Update the relevant parts of `src/cli/presentation.ts`:

```ts
function recordHeadline(result: CommandSuccess<MicrocanvasRecord>): string {
  if (result.record?.message?.toLowerCase().includes('verified')) return 'Verification complete';
  return headlineLabel(result.type, true);
}

function collectRecordRows(record: MicrocanvasRecord): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (record.message) rows.push(['Message', record.message]);
  if (record.surfaceId) rows.push(['Surface', record.surfaceId]);
  if (record.viewer) {
    rows.push(['Viewer', record.viewer.mode]);
    rows.push(['Viewer open', record.viewer.open ? 'yes' : 'no']);
    rows.push(['Native verify', record.viewer.canVerify ? 'available' : 'unavailable']);
  }
  if (record.lock) {
    rows.push(['Lock', record.lock.held ? `held${record.lock.reason ? ` • ${record.lock.reason}` : ''}` : 'clear']);
  }
  if (record.artifacts?.primary) rows.push(['Primary', record.artifacts.primary]);
  if (record.artifacts?.snapshot) rows.push(['Snapshot', record.artifacts.snapshot]);
  return rows;
}

export function renderCommandResult(
  result: CommandSuccess<MicrocanvasRecord> | CommandFailure,
  options: PresentationOptions
): string {
  const colors = palette(options.color);
  const pretty = options.mode === 'pretty';

  if (!result.ok) {
    const badge = pretty ? colors.bgRed(colors.black(' ERR ')) : 'ERR';
    const lines = [
      `${badge} ${pretty ? colors.bold(headlineLabel(result.type ?? 'result', false)) : headlineLabel(result.type ?? 'result', false)}`,
      formatRow('Code', result.error.code, colors, pretty),
      formatRow('Reason', result.error.message, colors, pretty)
    ];
    if (result.classification) lines.push(formatRow('Class', result.classification, colors, pretty));
    if (result.nextAction) lines.push(formatRow('Next', result.nextAction, colors, pretty));
    if (result.retryable !== undefined) lines.push(formatRow('Retryable', result.retryable ? 'yes' : 'no', colors, pretty));
    return lines.join('\\n');
  }

  const badge = pretty ? colors.bgCyan(colors.black(' OK ')) : 'OK';
  const lines = [
    `${badge} ${pretty ? colors.bold(recordHeadline(result)) : recordHeadline(result)}`
  ];

  if (result.record) {
    for (const [label, value] of collectRecordRows(result.record)) {
      lines.push(formatRow(label, value, colors, pretty));
    }
  }

  if (result.verificationStatus) lines.push(formatRow('Verification', result.verificationStatus, colors, pretty));
  if (result.nextAction) lines.push(formatRow('Next', result.nextAction, colors, pretty));

  if (result.warnings?.length) {
    const warningBadge = pretty ? colors.bgYellow(colors.black(' WARN ')) : 'WARN';
    for (const warning of result.warnings) lines.push(`${warningBadge} ${warning}`);
  }

  return lines.join('\\n');
}
```

- [ ] **Step 4: Run the full verification suite**

Run:
```bash
npm test
```

Expected:
- all CLI JSON contract tests still pass
- the new presentation unit tests pass
- the human-output integration assertions pass

- [ ] **Step 5: Commit**

```bash
git add src/cli/presentation.ts test/cli.test.mjs test/cli-presentation.test.mjs
git commit -m "test: validate cli pretty pass"
```

## Self-Review

- Spec coverage:
  - Help polish is covered in Task 2.
  - Shared success/failure/warning formatting is covered in Task 1 and tightened in Task 3.
  - Banner-inspired theme tokens are introduced in Task 1.
  - All commands benefit through shared record rendering, with integration coverage in Task 3.
  - JSON behavior is preserved by the custom dispatcher in Task 2 and verified in Task 3.

- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to previous task” shortcuts remain.

- Type consistency:
  - The plan uses one presentation module, one dispatcher path, and the existing `MicrocanvasRecord` shape throughout.

