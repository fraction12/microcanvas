import path from 'node:path';
import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { printResult } from '../../core/results.js';
import { readState, writeState } from '../../core/state.js';
import { getStagedSurface, promoteToActive, renderSurface } from '../../core/surface.js';
import { launchViewer } from '../../viewer/launch.js';

export async function runShow(sourceOrSurfaceId?: string): Promise<void> {
  if (!sourceOrSurfaceId) {
    printResult({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'show requires a source file path or staged surface id',
      surfaceId: null,
      viewer: { open: false },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  const blocked = acquireLock('show');
  if (blocked?.held) {
    printResult({
      ok: false,
      code: 'LOCKED_TRY_LATER',
      message: blocked.reason ?? 'runtime is locked',
      surfaceId: null,
      viewer: { open: false },
      lock: blocked,
      artifacts: {}
    });
    return;
  }

  let releasedEarly = false;

  try {
    const candidate = sourceOrSurfaceId.includes(path.sep) || sourceOrSurfaceId.includes('.')
      ? await renderSurface({ sourcePath: sourceOrSurfaceId })
      : getStagedSurface(sourceOrSurfaceId);

    promoteToActive(candidate.stagingDir);
    const activeEntry = path.join(paths.activeDir, candidate.manifest.entryPath);
    const viewer = await launchViewer(activeEntry);
    const current = readState();
    writeState({
      ...current,
      activeSurfaceId: candidate.manifest.surfaceId,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });

    releaseLock();
    releasedEarly = true;

    printResult({
      ok: true,
      code: 'OK',
      message: 'surface is now active',
      surfaceId: candidate.manifest.surfaceId,
      viewer,
      lock: readLock(),
      artifacts: { primary: activeEntry }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'show failed';
    const invalidInput = message.startsWith('INVALID_INPUT:');
    const unsupported = message.startsWith('UNSUPPORTED_CONTENT:');
    printResult({
      ok: false,
      code: unsupported ? 'UNSUPPORTED_CONTENT' : invalidInput ? 'INVALID_INPUT' : 'SURFACE_NOT_FOUND',
      message: (unsupported || invalidInput) ? message.replace(/^(INVALID_INPUT|UNSUPPORTED_CONTENT):\s*/, '') : message,
      surfaceId: null,
      viewer: { open: false },
      lock: { held: false },
      artifacts: {}
    });
  } finally {
    if (!releasedEarly) {
      releaseLock();
    }
  }
}
