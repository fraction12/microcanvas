import type { CommandResult } from 'agenttk';
import { firstPositional, hasFlag, markUnverified } from 'agenttk';
import path from 'node:path';
import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { paths } from '../../core/paths.js';
import { readState, writeState } from '../../core/state.js';
import { updateActiveSurface } from '../../core/surface.js';
import { launchViewer, nativeViewerRequiredByEnv } from '../../viewer/launch.js';
import {
  inputFailure,
  lockFailure,
  operationalFailure,
  parsePrefixedError,
  successResult,
  viewerLaunchFailure,
  type MicrocanvasRecord
} from '../contracts.js';

const strictNativeFlags = ['--native', '--strict-native'];

function parseUpdateArgs(rawArgs: string[]): { sourcePath?: string; requireNative: boolean } {
  return {
    sourcePath: firstPositional(rawArgs, strictNativeFlags),
    requireNative: hasFlag(rawArgs, strictNativeFlags) || nativeViewerRequiredByEnv()
  };
}

function viewerWarnings(viewer: MicrocanvasRecord['viewer'], closedMessage: string): string[] | undefined {
  const warnings: string[] = [];
  if (viewer?.mode === 'degraded') {
    warnings.push('Opened through degraded external display; native viewer-backed verify and snapshot are unavailable.');
  } else if (viewer?.mode === 'closed') {
    warnings.push(closedMessage);
  }

  if (viewer?.launch && viewer.launch.heartbeat.status !== 'fresh') {
    warnings.push(
      `Native viewer launch did not verify (${viewer.launch.heartbeat.status}); fallback used: ${viewer.launch.fallback.used ? 'yes' : 'no'}.`
    );
  }

  return warnings.length > 0 ? warnings : undefined;
}

export async function runUpdate(
  sourcePath?: string,
  options: { requireNative?: boolean } = {}
): Promise<CommandResult<MicrocanvasRecord>> {
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
    const requireNative = options.requireNative ?? nativeViewerRequiredByEnv();
    const viewer = await launchViewer(updated.primaryArtifact, {
      requireNative,
      expectedSurfaceId: updated.manifest.surfaceId
    });
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

    if (requireNative && viewer.mode !== 'native') {
      return viewerLaunchFailure(
        'update',
        'native viewer launch did not produce a verified heartbeat',
        viewer.launch
      );
    }

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
          canVerify: viewer.verificationCapable,
          launch: viewer.launch,
          launchDiagnostics: viewer.launchDiagnostics
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
      warnings: viewerWarnings(
        {
          mode: viewer.mode,
          open: viewer.open,
          canVerify: viewer.verificationCapable,
          launch: viewer.launch,
          launchDiagnostics: viewer.launchDiagnostics
        },
        'Surface was updated, but no viewer session could be opened.'
      )
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

export function runUpdateFromArgs(rawArgs: string[]): Promise<CommandResult<MicrocanvasRecord>> {
  const parsed = parseUpdateArgs(rawArgs);
  return runUpdate(parsed.sourcePath, { requireNative: parsed.requireNative });
}
