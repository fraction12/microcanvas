import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../core/paths.js';
import { printResult } from '../../core/results.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';
import { requestViewerSnapshot } from '../../viewer/snapshot.js';

export async function runSnapshot(): Promise<void> {
  const state = readState();

  if (!state.activeSurfaceId || !fs.existsSync(paths.activeManifest)) {
    printResult({
      ok: false,
      code: 'SURFACE_NOT_FOUND',
      message: 'no active surface to snapshot',
      surfaceId: null,
      viewer: { open: state.viewerOpen },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest;
  const sourcePath = path.join(paths.activeDir, manifest.entryPath);
  if (!fs.existsSync(sourcePath)) {
    printResult({
      ok: false,
      code: 'SURFACE_NOT_FOUND',
      message: 'active surface entry is missing',
      surfaceId: manifest.surfaceId,
      viewer: { open: state.viewerOpen },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  try {
    const snapshotPath = await requestViewerSnapshot(manifest.surfaceId);
    printResult({
      ok: true,
      code: 'OK',
      message: 'snapshot captured',
      surfaceId: manifest.surfaceId,
      viewer: { open: true },
      lock: { held: false },
      artifacts: { primary: sourcePath, snapshot: snapshotPath }
    });
  } catch (error) {
    printResult({
      ok: false,
      code: 'VERIFY_FAILED',
      message: error instanceof Error ? error.message : 'snapshot failed',
      surfaceId: manifest.surfaceId,
      viewer: { open: state.viewerOpen },
      lock: { held: false },
      artifacts: { primary: sourcePath }
    });
  }
}
