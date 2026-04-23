import type { CommandResult } from 'agenttk';
import { markUnverified } from 'agenttk';
import path from 'node:path';
import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { readState, writeState } from '../../core/state.js';
import { updateActiveSurface } from '../../core/surface.js';
import { launchViewer } from '../../viewer/launch.js';
import {
  inputFailure,
  lockFailure,
  operationalFailure,
  parsePrefixedError,
  successResult,
  type MicrocanvasRecord
} from '../contracts.js';

export async function runUpdate(sourcePath?: string): Promise<CommandResult<MicrocanvasRecord>> {
  if (!sourcePath) {
    return inputFailure('update', 'INVALID_INPUT', 'update requires a source file path');
  }

  const blocked = acquireLock('update');
  if (blocked?.held) {
    return lockFailure('update', blocked.reason);
  }

  let releasedEarly = false;

  try {
    const updated = await updateActiveSurface(sourcePath);
    const viewer = await launchViewer(updated.primaryArtifact);
    const current = readState();
    writeState({
      ...current,
      activeSurfaceId: updated.manifest.surfaceId,
      viewerMode: viewer.mode,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });

    releaseLock();
    releasedEarly = true;

    const result = successResult({
      type: 'update',
      id: updated.manifest.surfaceId,
      verificationStatus: 'not_applicable',
      record: {
        message: 'active surface updated',
        surfaceId: updated.manifest.surfaceId,
        viewer: {
          mode: viewer.mode,
          open: viewer.open,
          canVerify: viewer.verificationCapable
        },
        lock: {
          held: readLock().held
        },
        artifacts: {
          primary: updated.primaryArtifact,
          stagedSource: path.join(paths.activeDir, updated.manifest.source.stagedRelativePath)
        },
        source: {
          originalPath: updated.manifest.source.originalPath,
          stagedPath: path.join(paths.activeDir, updated.manifest.source.stagedRelativePath),
          externalToRepo: updated.manifest.source.externalToRepo
        }
      },
      warnings: viewer.mode === 'degraded'
        ? ['Opened through degraded external display; native viewer-backed verify and snapshot are unavailable.']
        : viewer.mode === 'closed'
          ? ['Surface was updated, but no viewer session could be opened.']
          : undefined
    });

    return viewer.mode === 'degraded'
      ? markUnverified(result, { status: 'unverified', nextAction: 'verify_state' })
      : result;
  } catch (error) {
    const parsed = parsePrefixedError(error);
    if (parsed.code === 'INVALID_INPUT' || parsed.code === 'UNSUPPORTED_CONTENT') {
      return inputFailure('update', parsed.code, parsed.message);
    }

    return operationalFailure('update', 'UPDATE_NOT_SUPPORTED', parsed.message, {
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
