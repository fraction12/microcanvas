import type { CommandResult } from 'agenttk';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../../core/paths.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';
import { requestViewerSnapshot } from '../../viewer/snapshot.js';
import { operationalFailure, successResult, type MicrocanvasRecord } from '../contracts.js';

export async function runSnapshot(): Promise<CommandResult<MicrocanvasRecord>> {
  const state = readState();

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
    const snapshotPath = await requestViewerSnapshot(manifest.surfaceId);
    return successResult({
      type: 'snapshot',
      id: manifest.surfaceId,
      verificationStatus: 'verified',
      verified: true,
      record: {
        message: 'snapshot captured',
        surfaceId: manifest.surfaceId,
        viewer: {
          mode: 'native',
          open: true,
          canVerify: true
        },
        lock: {
          held: false
        },
        artifacts: {
          primary: sourcePath,
          snapshot: snapshotPath
        }
      }
    });
  } catch (error) {
    return operationalFailure('snapshot', 'VERIFY_FAILED', error instanceof Error ? error.message : 'snapshot failed', {
      classification: 'unknown',
      retryable: true,
      nextAction: 'verify_state',
      verificationStatus: 'verification_failed'
    });
  }
}
