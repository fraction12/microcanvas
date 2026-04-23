import type { CommandResult } from 'agenttk';
import fs from 'node:fs';
import path from 'node:path';
import { readLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { readState } from '../../core/state.js';
import type { SurfaceManifest } from '../../core/manifest.js';
import { getViewerState } from '../../viewer/state.js';
import { successResult, type MicrocanvasRecord } from '../contracts.js';

export function runStatus(): CommandResult<MicrocanvasRecord> {
  const state = readState();
  const lock = readLock();
  const manifestExists = fs.existsSync(paths.activeManifest);
  const viewer = getViewerState(state);
  const manifest = manifestExists
    ? (JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest)
    : undefined;
  const primaryArtifact = manifest
    ? path.join(paths.activeDir, manifest.entryPath)
    : undefined;
  const stagedSource = manifest
    ? path.join(paths.activeDir, manifest.source.stagedRelativePath)
    : undefined;

  return successResult({
    type: 'status',
    id: state.activeSurfaceId ?? undefined,
    verificationStatus: 'not_applicable',
    record: {
      message: 'runtime state loaded',
      surfaceId: state.activeSurfaceId ?? undefined,
      viewer: {
        mode: viewer.mode,
        open: viewer.open,
        canVerify: viewer.verificationCapable
      },
      lock: {
        held: lock.held,
        reason: lock.reason
      },
      artifacts: {
        primary: primaryArtifact,
        stagedSource
      },
      source: manifest
        ? {
            originalPath: manifest.source.originalPath,
            stagedPath: stagedSource!,
            externalToRepo: manifest.source.externalToRepo
          }
        : undefined
    }
  });
}
