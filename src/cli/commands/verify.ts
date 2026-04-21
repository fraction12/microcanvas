import type { CommandResult } from 'agenttk';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../core/paths.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';
import { getViewerState, readViewerRuntimeState } from '../../viewer/state.js';
import { operationalFailure, successResult, type MicrocanvasRecord } from '../contracts.js';

export function runVerify(): CommandResult<MicrocanvasRecord> {
  const state = readState();

  if (!state.activeSurfaceId) {
    return operationalFailure('verify', 'VERIFY_FAILED', 'no active surface to verify', {
      classification: 'user_action_required',
      retryable: false,
      nextAction: 'verify_state'
    });
  }

  if (!fs.existsSync(paths.activeManifest)) {
    return operationalFailure('verify', 'VERIFY_FAILED', 'active manifest is missing', {
      classification: 'unknown',
      retryable: false,
      nextAction: 'verify_state'
    });
  }

  const manifest = JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest;
  const entryPath = path.join(paths.activeDir, manifest.entryPath);
  const entryExists = fs.existsSync(entryPath);
  const viewerState = readViewerRuntimeState();
  const viewer = getViewerState(state);
  const viewerMatchesSurface = viewerState?.activeSurfaceId === manifest.surfaceId;
  const verified = entryExists && viewer.verificationCapable && viewerMatchesSurface;

  if (!verified) {
    return operationalFailure(
      'verify',
      'VERIFY_FAILED',
      !entryExists
        ? 'active surface entry is missing'
        : !viewer.verificationCapable
          ? viewer.mode === 'degraded'
            ? 'native viewer confirmation is unavailable while the runtime is in degraded display mode'
            : 'viewer is not confirmed open'
          : 'viewer is open but not yet reporting the active surface',
      {
        classification: 'unknown',
        retryable: !entryExists ? false : true,
        nextAction: 'verify_state',
        verificationStatus: 'verification_failed'
      }
    );
  }

  return successResult({
    type: 'verify',
    id: manifest.surfaceId,
    verificationStatus: 'verified',
    verified: true,
    record: {
      message: 'active surface and viewer state verified',
      surfaceId: manifest.surfaceId,
      viewer: {
        mode: viewer.mode,
        open: viewer.open,
        canVerify: true
      },
      lock: {
        held: false
      },
      artifacts: {
        primary: entryPath
      }
    }
  });
}
