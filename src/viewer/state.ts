import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  viewerModeHasVerificationCapability,
  viewerModeIsOpen,
  type RuntimeState,
  type ViewerState
} from '../core/manifest.js';
import { paths } from '../core/paths.js';
import { readState } from '../core/state.js';

export interface ViewerRuntimeState {
  pid: number;
  lastSeenAt: string;
  activeSurfaceId?: string | null;
}

function isPidRunning(pid: number): boolean {
  try {
    execFileSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function readViewerRuntimeState(): ViewerRuntimeState | null {
  if (!fs.existsSync(paths.viewerStateFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(paths.viewerStateFile, 'utf8')) as ViewerRuntimeState;
  } catch {
    return null;
  }
}

function createViewerState(mode: ViewerState['mode'], details: Partial<ViewerState> = {}): ViewerState {
  return {
    mode,
    open: viewerModeIsOpen(mode),
    verificationCapable: viewerModeHasVerificationCapability(mode),
    pid: details.pid,
    lastSeenAt: details.lastSeenAt,
    activeSurfaceId: details.activeSurfaceId ?? null
  };
}

function getNativeViewerState(maxAgeMs = 5000): ViewerState | null {
  const state = readViewerRuntimeState();
  if (!state) return null;

  const ageMs = Date.now() - Date.parse(state.lastSeenAt);
  if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) return null;
  if (!isPidRunning(state.pid)) return null;

  return createViewerState('native', {
    pid: state.pid,
    lastSeenAt: state.lastSeenAt,
    activeSurfaceId: state.activeSurfaceId ?? null
  });
}

export function getViewerState(runtimeState: RuntimeState = readState(), maxAgeMs = 5000): ViewerState {
  const nativeViewer = getNativeViewerState(maxAgeMs);
  if (nativeViewer) {
    if (runtimeState.viewerMode === 'degraded') {
      return createViewerState('degraded', {
        activeSurfaceId: runtimeState.activeSurfaceId
      });
    }
    return nativeViewer;
  }

  if (runtimeState.viewerMode === 'degraded') {
    return createViewerState('degraded', {
      activeSurfaceId: runtimeState.activeSurfaceId
    });
  }

  return createViewerState('closed', {
    activeSurfaceId: runtimeState.activeSurfaceId
  });
}

export function hasNativeViewerCapability(runtimeState: RuntimeState = readState(), maxAgeMs = 5000): boolean {
  return getViewerState(runtimeState, maxAgeMs).verificationCapable;
}

export function getViewerOpenStatus(maxAgeMs = 5000, runtimeState: RuntimeState = readState()): boolean {
  return getViewerState(runtimeState, maxAgeMs).open;
}
