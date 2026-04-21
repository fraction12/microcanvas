import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../core/paths.js';
import { printResult } from '../../core/results.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';

export function runVerify(): void {
  const state = readState();

  if (!state.activeSurfaceId) {
    printResult({
      ok: false,
      code: 'VERIFY_FAILED',
      message: 'no active surface to verify',
      surfaceId: null,
      viewer: { open: state.viewerOpen },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  if (!fs.existsSync(paths.activeManifest)) {
    printResult({
      ok: false,
      code: 'VERIFY_FAILED',
      message: 'active manifest is missing',
      surfaceId: state.activeSurfaceId,
      viewer: { open: state.viewerOpen },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest;
  const entryPath = path.join(paths.activeDir, manifest.entryPath);
  const entryExists = fs.existsSync(entryPath);

  printResult({
    ok: entryExists,
    code: entryExists ? 'OK' : 'VERIFY_FAILED',
    message: entryExists ? 'active surface verified' : 'active surface entry is missing',
    surfaceId: manifest.surfaceId,
    viewer: { open: state.viewerOpen },
    lock: { held: false },
    artifacts: entryExists ? { primary: entryPath } : {}
  });
}
