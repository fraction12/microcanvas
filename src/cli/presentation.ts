import pc from 'picocolors';
import type { CommandFailure, CommandResult, HelpRecord } from 'agenttk';
import type { MicrocanvasRecord } from './contracts.js';

export type PresentationMode = 'pretty' | 'plain';

export const paletteTokens = {
  teal: '#1f9d94',
  coral: '#f27d72',
  cream: '#f7efe2',
  ink: '#17212b',
  slate: '#5a6a78'
} as const;

const TOOL_TAGLINE = 'tiny stagehand for AI tools';

function colorsFor(mode: PresentationMode) {
  const colors = pc.createColors(mode === 'pretty');
  return {
    headline: (text: string) => colors.bold(colors.cyan(text)),
    ok: (text: string) => colors.bold(colors.green(text)),
    error: (text: string) => colors.bold(colors.red(text)),
    warning: (text: string) => colors.bold(colors.yellow(text)),
    accent: (text: string) => colors.bold(colors.magenta(text)),
    muted: (text: string) => colors.dim(text)
  };
}

function formatLabel(text: string): string {
  return text
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  return String(value);
}

function commandExample(toolName: string, commandName: string): string {
  if (commandName === 'show' || commandName === 'render' || commandName === 'update') {
    return `${toolName} ${commandName} README.md`;
  }

  return `${toolName} ${commandName}`;
}

function buildQuickStartExamples(record: Extract<HelpRecord, { kind: 'tool' }>): string[] {
  const preferredOrder = ['show', 'render', 'status'];
  const names = new Set(record.commands.map((command) => command.name));
  const ordered = preferredOrder.filter((name) => names.has(name));

  for (const command of record.commands) {
    if (!ordered.includes(command.name)) {
      ordered.push(command.name);
    }
  }

  return ordered.slice(0, 3).map((name) => commandExample(record.name, name));
}

function pushKeyValue(lines: string[], label: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    return;
  }

  lines.push(`${label}: ${formatValue(value)}`);
}

function renderWarnings(lines: string[], warnings: string[] | undefined, mode: PresentationMode): void {
  if (!warnings?.length) {
    return;
  }

  const colors = colorsFor(mode);
  for (const warning of warnings) {
    lines.push(`${colors.warning('Warning:')} ${warning}`);
  }
}

function formatFailureHeadline(result: CommandFailure): string {
  if (result.type && result.error.code.endsWith('_FAILED')) {
    return `${formatLabel(result.type)} failed`;
  }

  return formatLabel(result.type ?? result.error.code.toLowerCase());
}

function renderSuccess(result: Extract<CommandResult<MicrocanvasRecord>, { ok: true }>, mode: PresentationMode): string {
  const colors = colorsFor(mode);
  const lines = [`${colors.ok('OK')} ${formatLabel(result.type)}`];
  const record = result.record;

  pushKeyValue(lines, 'Surface', result.id ?? record?.surfaceId);
  pushKeyValue(lines, 'Message', record?.message);
  pushKeyValue(lines, 'Viewer', record?.viewer?.mode);
  pushKeyValue(lines, 'Viewer open', record?.viewer?.open);
  pushKeyValue(lines, 'Verify ready', record?.viewer?.canVerify);
  pushKeyValue(lines, 'Lock held', record?.lock?.held);
  pushKeyValue(lines, 'Lock reason', record?.lock?.reason);
  pushKeyValue(lines, 'Primary', record?.artifacts?.primary);
  pushKeyValue(lines, 'Snapshot', record?.artifacts?.snapshot);
  pushKeyValue(lines, 'Verification', result.verificationStatus);

  renderWarnings(lines, result.warnings, mode);

  return lines.join('\n');
}

function renderFailure(result: CommandFailure, mode: PresentationMode): string {
  const colors = colorsFor(mode);
  const lines = [`${colors.error('ERR')} ${formatFailureHeadline(result)}`];
  const reason =
    typeof result.error.details?.reason === 'string' ? result.error.details.reason : result.error.message;

  pushKeyValue(lines, 'Code', result.error.code);
  pushKeyValue(lines, 'Reason', reason);
  pushKeyValue(lines, 'Classification', result.classification);
  pushKeyValue(lines, 'Retryable', result.retryable);
  pushKeyValue(lines, 'Next', result.nextAction);
  pushKeyValue(lines, 'Verification', result.verificationStatus);

  return lines.join('\n');
}

function renderCommandHelp(record: Extract<HelpRecord, { kind: 'command' }>, mode: PresentationMode): string {
  const colors = colorsFor(mode);
  const lines = [colors.headline(`${record.toolName} ${record.name}`)];

  if (record.description) {
    lines.push(record.description);
  }

  pushKeyValue(lines, 'Usage', record.usage);

  if (record.examples?.length) {
    lines.push(colors.accent('Examples:'));
    for (const example of record.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}

function renderToolOverview(record: Extract<HelpRecord, { kind: 'tool' }>, mode: PresentationMode): string {
  const colors = colorsFor(mode);
  const lines = [colors.headline(record.name), TOOL_TAGLINE];
  const quickStartExamples = buildQuickStartExamples(record);

  if (record.description) {
    lines.push(colors.muted(record.description));
  }

  lines.push('');
  lines.push(colors.accent('Commands:'));
  for (const command of record.commands) {
    const summary = command.description ? ` - ${command.description}` : '';
    lines.push(`  ${command.name}${summary}`);
  }

  lines.push('');
  lines.push(colors.accent('Try first:'));
  for (const example of quickStartExamples) {
    lines.push(`  ${example}`);
  }

  return lines.join('\n');
}

export function resolvePresentationMode(
  stdout: Pick<NodeJS.WriteStream, 'isTTY'> | undefined,
  env: NodeJS.ProcessEnv = process.env
): PresentationMode {
  return stdout?.isTTY && !Object.prototype.hasOwnProperty.call(env, 'NO_COLOR') ? 'pretty' : 'plain';
}

export function renderToolHelp(record: HelpRecord, mode: PresentationMode = 'plain'): string {
  return record.kind === 'tool' ? renderToolOverview(record, mode) : renderCommandHelp(record, mode);
}

export function renderCommandResult(
  result: CommandResult<MicrocanvasRecord>,
  mode: PresentationMode = 'plain'
): string {
  return result.ok ? renderSuccess(result, mode) : renderFailure(result, mode);
}
