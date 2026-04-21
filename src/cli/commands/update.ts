import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { printResult } from '../../core/results.js';
import { readState, writeState } from '../../core/state.js';
import { updateActiveSurface } from '../../core/surface.js';
import { launchViewer } from '../../viewer/launch.js';

export async function runUpdate(sourcePath?: string): Promise<void> {
  if (!sourcePath) {
    printResult({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'update requires a source file path',
      surfaceId: null,
      viewer: { open: false },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  const blocked = acquireLock('update');
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
    const updated = await updateActiveSurface(sourcePath);
    const viewer = await launchViewer(updated.primaryArtifact);
    const current = readState();
    writeState({
      ...current,
      activeSurfaceId: updated.manifest.surfaceId,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });

    releaseLock();
    releasedEarly = true;

    printResult({
      ok: true,
      code: 'OK',
      message: 'active surface updated',
      surfaceId: updated.manifest.surfaceId,
      viewer,
      lock: readLock(),
      artifacts: { primary: updated.primaryArtifact }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'update failed';
    const invalidInput = message.startsWith('INVALID_INPUT:');
    const unsupported = message.startsWith('UNSUPPORTED_CONTENT:');
    printResult({
      ok: false,
      code: unsupported ? 'UNSUPPORTED_CONTENT' : invalidInput ? 'INVALID_INPUT' : 'UPDATE_NOT_SUPPORTED',
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
