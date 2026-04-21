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
