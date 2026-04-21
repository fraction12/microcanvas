import type { CommandResult } from 'agenttk';
import { markUnverified } from 'agenttk';
import path from 'node:path';
import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { readState, writeState } from '../../core/state.js';
import { getStagedSurface, promoteToActive, renderSurface } from '../../core/surface.js';
import { launchViewer } from '../../viewer/launch.js';
import {
  inputFailure,
  lockFailure,
  operationalFailure,
  parsePrefixedError,
  successResult,
  type MicrocanvasRecord
} from '../contracts.js';

export async function runShow(sourceOrSurfaceId?: string): Promise<CommandResult<MicrocanvasRecord>> {
  if (!sourceOrSurfaceId) {
    return inputFailure('show', 'INVALID_INPUT', 'show requires a source file path or staged surface id');
  }

  const blocked = acquireLock('show');
  if (blocked?.held) {
    return lockFailure('show', blocked.reason);
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
      viewerMode: viewer.mode,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });

    releaseLock();
    releasedEarly = true;

    const result = successResult({
      type: 'show',
      id: candidate.manifest.surfaceId,
      verificationStatus: 'not_applicable',
      record: {
        message: 'surface is now active',
        surfaceId: candidate.manifest.surfaceId,
        viewer: {
          mode: viewer.mode,
          open: viewer.open,
          canVerify: viewer.verificationCapable
        },
        lock: {
          held: readLock().held
        },
        artifacts: {
          primary: activeEntry
        }
      },
      warnings: viewer.mode === 'degraded'
        ? ['Opened through degraded external display; native viewer-backed verify and snapshot are unavailable.']
        : viewer.mode === 'closed'
          ? ['Surface was activated, but no viewer session could be opened.']
          : undefined
    });

    return viewer.mode === 'degraded'
      ? markUnverified(result, { status: 'unverified', nextAction: 'verify_state' })
      : result;
  } catch (error) {
    const parsed = parsePrefixedError(error);
    if (parsed.code === 'INVALID_INPUT' || parsed.code === 'UNSUPPORTED_CONTENT') {
      return inputFailure('show', parsed.code, parsed.message);
    }

    return operationalFailure('show', 'SURFACE_NOT_FOUND', parsed.message, {
      classification: 'user_action_required',
      retryable: false,
      nextAction: 'fix_input'
    });
  } finally {
    if (!releasedEarly) {
      releaseLock();
    }
  }
}
