import type { CommandResult } from 'agenttk';
import { firstPositional, hasFlag, markUnverified } from 'agenttk';
import path from 'node:path';
import { acquireLock, readLock, releaseLock } from '../../core/lock.js';
import { recordSourceHistoryFromManifest } from '../../core/history.js';
import { paths } from '../../core/paths.js';
import { readState, writeState } from '../../core/state.js';
import { getStagedSurface, promoteToActive, renderSurface } from '../../core/surface.js';
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

function parseShowArgs(rawArgs: string[]): { sourceOrSurfaceId?: string; requireNative: boolean } {
  return {
    sourceOrSurfaceId: firstPositional(rawArgs, strictNativeFlags),
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

export async function runShow(
  sourceOrSurfaceId?: string,
  options: { requireNative?: boolean } = {}
): Promise<CommandResult<MicrocanvasRecord>> {
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
    const requireNative = options.requireNative ?? nativeViewerRequiredByEnv();
    const viewer = await launchViewer(activeEntry, {
      requireNative,
      expectedSurfaceId: candidate.manifest.surfaceId
    });
    const current = readState();
    writeState({
      ...current,
      activeSurfaceId: candidate.manifest.surfaceId,
      viewerMode: viewer.mode,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });
    try {
      recordSourceHistoryFromManifest(candidate.manifest);
    } catch {
      // History is private convenience metadata; display success must not depend on it.
    }

    releaseLock();
    releasedEarly = true;

    if (requireNative && viewer.mode !== 'native') {
      return viewerLaunchFailure(
        'show',
        'native viewer launch did not produce a verified heartbeat',
        viewer.launch
      );
    }

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
          canVerify: viewer.verificationCapable,
          launch: viewer.launch,
          launchDiagnostics: viewer.launchDiagnostics
        },
        lock: {
          held: readLock().held
        },
        artifacts: {
          primary: activeEntry,
          stagedSource: path.join(paths.activeDir, candidate.manifest.source.stagedRelativePath)
        },
        source: {
          originalPath: candidate.manifest.source.originalPath,
          stagedPath: path.join(paths.activeDir, candidate.manifest.source.stagedRelativePath),
          externalToRepo: candidate.manifest.source.externalToRepo
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
        'Surface was activated, but no viewer session could be opened.'
      )
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

export function runShowFromArgs(rawArgs: string[]): Promise<CommandResult<MicrocanvasRecord>> {
  const parsed = parseShowArgs(rawArgs);
  return runShow(parsed.sourceOrSurfaceId, { requireNative: parsed.requireNative });
}
