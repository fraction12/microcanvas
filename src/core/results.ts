export type ResultCode =
  | 'OK'
  | 'LOCKED_TRY_LATER'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_CONTENT'
  | 'VIEWER_LAUNCH_FAILED'
  | 'SURFACE_NOT_FOUND'
  | 'UPDATE_NOT_SUPPORTED'
  | 'VERIFY_FAILED';

export interface CommandResult {
  ok: boolean;
  code: ResultCode;
  message: string;
  surfaceId?: string | null;
  viewer: { open: boolean };
  lock: { held: boolean; reason?: string };
  artifacts: { primary?: string; snapshot?: string };
}

export function printResult(result: CommandResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function renderHumanResult(result: CommandResult): string {
  const status = result.ok ? 'OK' : result.code;
  const lines = [`${status}: ${result.message}`];

  if (result.surfaceId) {
    lines.push(`surface: ${result.surfaceId}`);
  }
  if (result.viewer.open) {
    lines.push('viewer: open');
  }
  if (result.lock.held) {
    lines.push(`lock: held${result.lock.reason ? ` (${result.lock.reason})` : ''}`);
  }
  if (result.artifacts.primary) {
    lines.push(`primary: ${result.artifacts.primary}`);
  }
  if (result.artifacts.snapshot) {
    lines.push(`snapshot: ${result.artifacts.snapshot}`);
  }

  return lines.join('\n');
}

export function printHumanResult(result: CommandResult): void {
  const text = renderHumanResult(result);
  const stream = result.ok ? process.stdout : process.stderr;
  stream.write(`${text}\n`);
}
