import { printResult } from '../../core/results.js';

export function runShow(): void {
  printResult({
    ok: false,
    code: 'UPDATE_NOT_SUPPORTED',
    message: 'show not implemented yet',
    surfaceId: null,
    viewer: { open: false },
    lock: { held: false },
    artifacts: {}
  });
}
