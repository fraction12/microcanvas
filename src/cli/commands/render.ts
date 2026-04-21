import { printResult } from '../../core/results.js';

export function runRender(): void {
  printResult({
    ok: false,
    code: 'UPDATE_NOT_SUPPORTED',
    message: 'render not implemented yet',
    surfaceId: null,
    viewer: { open: false },
    lock: { held: false },
    artifacts: {}
  });
}
