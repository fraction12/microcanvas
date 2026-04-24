import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  type ViewerHeartbeatDiagnostics,
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

export function assessNativeViewerHeartbeat(
  runtimeState: RuntimeState = readState(),
  maxAgeMs = 5000,
  expectedSurfaceId: string | null = runtimeState.activeSurfaceId
): { viewer: ViewerState | null; heartbeat: ViewerHeartbeatDiagnostics } {
  const state = readViewerRuntimeState();
  if (!state) {
    return {
      viewer: null,
      heartbeat: {
        status: 'missing',
        expectedSurfaceId,
        reason: 'viewer heartbeat file is missing'
      }
    };
  }

  const ageMs = Date.now() - Date.parse(state.lastSeenAt);
  const heartbeatBase = {
    pid: state.pid,
    lastSeenAt: state.lastSeenAt,
    activeSurfaceId: state.activeSurfaceId ?? null,
    expectedSurfaceId
  };

  if (!Number.isFinite(ageMs)) {
    return {
      viewer: null,
      heartbeat: {
        ...heartbeatBase,
        status: 'invalid',
        reason: 'viewer heartbeat timestamp is invalid'
      }
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      viewer: null,
      heartbeat: {
        ...heartbeatBase,
        status: 'stale',
        ageMs,
        reason: `viewer heartbeat is older than ${maxAgeMs}ms`
      }
    };
  }

  if (!isPidRunning(state.pid)) {
    return {
      viewer: null,
      heartbeat: {
        ...heartbeatBase,
        status: 'pid_not_running',
        ageMs,
        reason: 'viewer heartbeat process is not running'
      }
    };
  }

  if (expectedSurfaceId !== null && (state.activeSurfaceId ?? null) !== expectedSurfaceId) {
    return {
      viewer: null,
      heartbeat: {
        ...heartbeatBase,
        status: 'surface_mismatch',
        ageMs,
        reason: 'viewer heartbeat does not match the active surface'
      }
    };
  }

  const viewer = createViewerState('native', {
    pid: state.pid,
    lastSeenAt: state.lastSeenAt,
    activeSurfaceId: state.activeSurfaceId ?? null
  });

  return {
    viewer,
    heartbeat: {
      ...heartbeatBase,
      status: 'fresh',
      ageMs
    }
  };
}

export function getViewerState(runtimeState: RuntimeState = readState(), maxAgeMs = 5000): ViewerState {
  const { viewer: nativeViewer } = assessNativeViewerHeartbeat(runtimeState, maxAgeMs);
  if (nativeViewer) {
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
