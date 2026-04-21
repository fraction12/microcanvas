import fs from 'node:fs';
import { readLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { printResult } from '../../core/results.js';
import { readState } from '../../core/state.js';
import { getViewerOpenStatus } from '../../viewer/state.js';

export function runStatus(): void {
  const state = readState();
  const lock = readLock();
  const manifestExists = fs.existsSync(paths.activeManifest);
  const viewerOpen = getViewerOpenStatus() || state.viewerOpen;

  printResult({
    ok: true,
    code: 'OK',
    message: 'runtime state loaded',
    surfaceId: state.activeSurfaceId,
    viewer: { open: viewerOpen },
    lock,
    artifacts: manifestExists ? { primary: paths.activeManifest } : {}
  });
}
