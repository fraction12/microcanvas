import type { CommandResult } from 'agenttk';
import { markUnverified } from 'agenttk';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../core/paths.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';
import {
  HOLD_LAST_GOOD_SNAPSHOT_MESSAGE,
  HOLD_LAST_GOOD_SNAPSHOT_WARNING,
  requestViewerSnapshot
} from '../../viewer/snapshot.js';
import { getViewerState } from '../../viewer/state.js';
import { operationalFailure, successResult, type MicrocanvasRecord } from '../contracts.js';

export async function runSnapshot(): Promise<CommandResult<MicrocanvasRecord>> {
  const state = readState();
  const viewer = getViewerState(state);

  if (!state.activeSurfaceId || !fs.existsSync(paths.activeManifest)) {
    return operationalFailure('snapshot', 'SURFACE_NOT_FOUND', 'no active surface to snapshot', {
      classification: 'user_action_required',
      retryable: false,
      nextAction: 'verify_state'
    });
  }

  const manifest = JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest;
  const sourcePath = path.join(paths.activeDir, manifest.entryPath);
  if (!fs.existsSync(sourcePath)) {
    return operationalFailure('snapshot', 'SURFACE_NOT_FOUND', 'active surface entry is missing', {
      classification: 'unknown',
      retryable: false,
      nextAction: 'verify_state'
    });
  }

  try {
    const snapshot = await requestViewerSnapshot(manifest.surfaceId);
    const degraded = snapshot.captureState === 'degraded';
    const result = successResult({
      type: 'snapshot',
      id: manifest.surfaceId,
      verificationStatus: degraded ? 'unverified' : 'verified',
      verified: !degraded,
      record: {
        message: degraded
          ? HOLD_LAST_GOOD_SNAPSHOT_MESSAGE
          : 'snapshot captured',
        surfaceId: manifest.surfaceId,
        viewer: {
          mode: viewer.mode,
          open: viewer.open,
          canVerify: viewer.verificationCapable
        },
        lock: {
          held: false
        },
        artifacts: {
          primary: sourcePath,
          snapshot: snapshot.snapshotPath
        }
      },
      warnings: degraded
        ? [snapshot.warning ?? HOLD_LAST_GOOD_SNAPSHOT_WARNING]
        : undefined
    });

    return degraded
      ? markUnverified(result, { status: 'unverified', nextAction: 'verify_state' })
      : result;
  } catch (error) {
    return operationalFailure('snapshot', 'VERIFY_FAILED', error instanceof Error ? error.message : 'snapshot failed', {
      classification: 'unknown',
      retryable: true,
      nextAction: 'verify_state',
      verificationStatus: 'verification_failed'
    });
  }
}
