import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import {
  viewerModeIsOpen,
  type NativeViewerLaunchMethod,
  type RuntimeState,
  type ViewerHeartbeatDiagnostics,
  type ViewerLaunchAttempt,
  type ViewerLaunchDiagnostics,
  type ViewerState
} from '../core/manifest.js';
import { paths } from '../core/paths.js';
import { readState, writeState } from '../core/state.js';
import { assessNativeViewerHeartbeat, getViewerState, readViewerRuntimeState } from './state.js';

export interface LaunchViewerOptions {
  requireNative?: boolean;
  expectedSurfaceId?: string | null;
}

interface NativeLaunchTarget {
  method: NativeViewerLaunchMethod;
  path: string;
  pidPatterns: string[];
}

interface NativeLaunchResult {
  target?: NativeLaunchTarget;
  attempt: ViewerLaunchAttempt;
}

function viewerPackageDir(): string {
  return path.join(paths.repoRoot, 'apps', 'macos-viewer', 'MicrocanvasViewer');
}

function viewerBinaryPath(): string {
  if (process.env.MICROCANVAS_NATIVE_VIEWER_BINARY_PATH) {
    return process.env.MICROCANVAS_NATIVE_VIEWER_BINARY_PATH;
  }

  return path.join(viewerPackageDir(), '.build', 'arm64-apple-macosx', 'debug', 'MicrocanvasViewer');
}

function viewerAppBundleCandidates(): string[] {
  const configured = process.env.MICROCANVAS_NATIVE_VIEWER_APP_PATH
    ? [process.env.MICROCANVAS_NATIVE_VIEWER_APP_PATH]
    : [];

  return [
    ...configured,
    path.join(viewerPackageDir(), '.build', 'MicrocanvasViewer.app'),
    path.join(viewerPackageDir(), '.build', 'arm64-apple-macosx', 'debug', 'MicrocanvasViewer.app'),
    path.join(paths.repoRoot, 'apps', 'macos-viewer', 'build', 'MicrocanvasViewer.app')
  ];
}

function viewerAppExecutablePath(appBundlePath: string): string {
  return path.join(appBundlePath, 'Contents', 'MacOS', 'MicrocanvasViewer');
}

function viewerAppBundleBuildScripts(): string[] {
  const configured = process.env.MICROCANVAS_NATIVE_VIEWER_BUILD_COMMAND
    ? [process.env.MICROCANVAS_NATIVE_VIEWER_BUILD_COMMAND]
    : [];

  return [
    ...configured,
    path.join(paths.repoRoot, 'apps', 'macos-viewer', 'scripts', 'build-app-bundle.sh'),
    path.join(paths.repoRoot, 'apps', 'macos-viewer', 'scripts', 'build-microcanvas-viewer-app.sh'),
    path.join(viewerPackageDir(), 'scripts', 'build-app-bundle.sh')
  ];
}

function nativeViewerLaunchDisabled(): boolean {
  return process.env.MICROCANVAS_DISABLE_NATIVE_VIEWER === '1';
}

export function nativeViewerRequiredByEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MICROCANVAS_REQUIRE_NATIVE_VIEWER === '1'
    || env.MICROCANVAS_STRICT_NATIVE_VIEWER === '1';
}

function findViewerAppBundle(): string | null {
  return viewerAppBundleCandidates().find((candidate) => {
    return fs.existsSync(candidate) && fs.existsSync(viewerAppExecutablePath(candidate));
  }) ?? null;
}

function ensureViewerAppBundleBuilt(): { appBundlePath: string | null; error?: string } {
  const existing = findViewerAppBundle();
  if (existing) {
    return { appBundlePath: existing };
  }

  const script = viewerAppBundleBuildScripts().find((candidate) => fs.existsSync(candidate));
  if (!script) {
    return { appBundlePath: null };
  }

  try {
    execFileSync(script, [], {
      cwd: paths.repoRoot,
      stdio: 'ignore'
    });
  } catch (error) {
    return {
      appBundlePath: null,
      error: error instanceof Error ? error.message : 'app bundle build failed'
    };
  }

  return { appBundlePath: findViewerAppBundle() };
}

function ensureNativeViewerBuilt(): boolean {
  const packageFile = path.join(viewerPackageDir(), 'Package.swift');
  if (!fs.existsSync(packageFile)) {
    return false;
  }

  const binary = viewerBinaryPath();
  if (fs.existsSync(binary)) {
    return true;
  }

  try {
    execFileSync('swift', ['build'], {
      cwd: viewerPackageDir(),
      stdio: 'ignore'
    });
    return fs.existsSync(binary);
  } catch {
    return false;
  }
}

function findViewerPids(binaryPath: string): number[] {
  try {
    const output = execFileSync('pgrep', ['-f', binaryPath], { encoding: 'utf8' });
    return output
      .split(/\s+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function isViewerRunning(binaryPath: string): boolean {
  return findViewerPids(binaryPath).length > 0;
}

function isPidRunning(pid: number): boolean {
  try {
    execFileSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function stopProcess(pid: number): boolean {
  try {
    execFileSync('kill', ['-TERM', String(pid)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function heartbeatMatchesLaunchTarget(
  target: NativeLaunchTarget,
  heartbeat: ViewerHeartbeatDiagnostics
): ViewerHeartbeatDiagnostics {
  if (heartbeat.status !== 'fresh' || !heartbeat.pid) {
    return heartbeat;
  }

  const runningPids = new Set(target.pidPatterns.flatMap((pattern) => findViewerPids(pattern)));
  if (runningPids.size > 0 && !runningPids.has(heartbeat.pid)) {
    return {
      ...heartbeat,
      status: 'pid_mismatch',
      reason: 'viewer heartbeat process does not match the launched native viewer target'
    };
  }

  return heartbeat;
}

function getMatchingNativeHeartbeat(
  runtimeState: RuntimeState,
  expectedSurfaceId: string | null,
  target?: NativeLaunchTarget
): { viewer: ViewerState | null; heartbeat: ViewerHeartbeatDiagnostics } {
  const assessed = assessNativeViewerHeartbeat(runtimeState, 5000, expectedSurfaceId);
  if (!target) {
    return assessed;
  }

  const heartbeat = heartbeatMatchesLaunchTarget(target, assessed.heartbeat);
  if (heartbeat.status !== 'fresh') {
    return {
      viewer: null,
      heartbeat
    };
  }

  return assessed;
}

async function waitForNativeViewer(
  runtimeState: RuntimeState,
  expectedSurfaceId: string | null,
  target: NativeLaunchTarget,
  maxWaitMs = 1500
): Promise<{ viewer: ViewerState | null; heartbeat: ViewerHeartbeatDiagnostics; waitedMs: number }> {
  const startedAt = Date.now();
  let heartbeat: ViewerHeartbeatDiagnostics = {
    status: 'missing',
    expectedSurfaceId,
    reason: 'viewer heartbeat file is missing'
  };

  while (Date.now() - startedAt < maxWaitMs) {
    const assessed = getMatchingNativeHeartbeat(runtimeState, expectedSurfaceId, target);
    heartbeat = assessed.heartbeat;
    const viewer = assessed.viewer;
    if (viewer) {
      return { viewer, heartbeat, waitedMs: Date.now() - startedAt };
    }
    await sleep(50);
  }

  return { viewer: null, heartbeat, waitedMs: Date.now() - startedAt };
}

async function stopStaleViewerSessions(pidPatterns: string[], runtimeState: RuntimeState): Promise<void> {
  const runtimeViewer = readViewerRuntimeState();
  if (!runtimeViewer) {
    return;
  }

  const pids = Array.from(new Set(pidPatterns.flatMap((pattern) => findViewerPids(pattern))));
  if (pids.length === 0) {
    return;
  }

  const staleRuntimeViewer = !pids.includes(runtimeViewer.pid)
    || !isPidRunning(runtimeViewer.pid)
    || (runtimeState.activeSurfaceId !== null
      && runtimeViewer.activeSurfaceId !== null
      && runtimeViewer.activeSurfaceId !== runtimeState.activeSurfaceId);

  if (!staleRuntimeViewer) {
    return;
  }

  for (const pid of pids) {
    stopProcess(pid);
  }

  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    const remaining = Array.from(new Set(pidPatterns.flatMap((pattern) => findViewerPids(pattern))));
    if (remaining.length === 0) {
      break;
    }
    await sleep(50);
  }

  fs.rmSync(paths.viewerStateFile, { force: true });
}

function launchAppBundle(): NativeLaunchResult {
  const { appBundlePath, error } = ensureViewerAppBundleBuilt();
  const attempt: ViewerLaunchAttempt = {
    method: 'app-bundle',
    path: appBundlePath ?? viewerAppBundleCandidates()[0],
    available: Boolean(appBundlePath),
    launched: false,
    error
  };

  if (!appBundlePath) {
    attempt.reason = error ? 'app_bundle_build_failed' : 'app_bundle_unavailable';
    return { attempt };
  }

  const target: NativeLaunchTarget = {
    method: 'app-bundle',
    path: appBundlePath,
    pidPatterns: [viewerAppExecutablePath(appBundlePath)]
  };

  if (isViewerRunning(viewerAppExecutablePath(appBundlePath))) {
    return {
      target,
      attempt: {
        ...attempt,
        launched: true,
        reused: true
      }
    };
  }

  try {
    execFileSync('open', ['-n', appBundlePath, '--args', '--repo-root', paths.repoRoot], {
      cwd: paths.repoRoot,
      stdio: 'ignore'
    });
    return {
      target,
      attempt: {
        ...attempt,
        launched: true
      }
    };
  } catch (launchError) {
    return {
      attempt: {
        ...attempt,
        reason: 'app_bundle_launch_failed',
        error: launchError instanceof Error ? launchError.message : 'app bundle launch failed'
      }
    };
  }
}

function launchNativeViewerBinary(): NativeLaunchResult {
  const binary = viewerBinaryPath();
  const attempt: ViewerLaunchAttempt = {
    method: 'swiftpm-binary',
    path: binary,
    available: false,
    launched: false
  };

  if (nativeViewerLaunchDisabled()) {
    return {
      attempt: {
        ...attempt,
        reason: 'native_viewer_launch_disabled'
      }
    };
  }

  if (!ensureNativeViewerBuilt()) {
    return {
      attempt: {
        ...attempt,
        reason: 'swiftpm_binary_unavailable'
      }
    };
  }

  const target: NativeLaunchTarget = {
    method: 'swiftpm-binary',
    path: binary,
    pidPatterns: [binary]
  };

  if (isViewerRunning(binary)) {
    return {
      target,
      attempt: {
        ...attempt,
        available: true,
        launched: true,
        reused: true
      }
    };
  }

  try {
    const child = spawn(binary, ['--repo-root', paths.repoRoot], {
      cwd: paths.repoRoot,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return {
      target,
      attempt: {
        ...attempt,
        available: true,
        launched: true
      }
    };
  } catch {
    return {
      attempt: {
        ...attempt,
        available: true,
        reason: 'swiftpm_binary_launch_failed'
      }
    };
  }
}

function launchNativeViewer(): NativeLaunchResult[] {
  if (nativeViewerLaunchDisabled()) {
    return [
      {
        attempt: {
          method: 'app-bundle',
          path: viewerAppBundleCandidates()[0],
          available: false,
          launched: false,
          reason: 'native_viewer_launch_disabled'
        }
      },
      launchNativeViewerBinary()
    ];
  }

  if (process.platform !== 'darwin') {
    return [
      {
        attempt: {
          method: 'app-bundle',
          path: viewerAppBundleCandidates()[0],
          available: false,
          launched: false,
          reason: 'unsupported_platform'
        }
      },
      launchNativeViewerBinary()
    ];
  }

  const app = launchAppBundle();
  if (app.target) {
    return [app];
  }

  const binary = launchNativeViewerBinary();
  return [app, binary];
}

function openPath(entryPath: string): boolean {
  if (nativeViewerLaunchDisabled()) {
    return false;
  }

  try {
    if (process.env.MICROCANVAS_EXTERNAL_OPEN_COMMAND) {
      execFileSync(process.env.MICROCANVAS_EXTERNAL_OPEN_COMMAND, [entryPath], { stdio: 'ignore' });
      return true;
    }

    execFileSync('open', [entryPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildViewerState(mode: ViewerState['mode'], activeSurfaceId: string | null): ViewerState {
  return {
    mode,
    open: viewerModeIsOpen(mode),
    verificationCapable: mode === 'native',
    activeSurfaceId
  };
}

function buildLaunchDiagnostics(input: {
  attempts: ViewerLaunchAttempt[];
  heartbeat: ViewerHeartbeatDiagnostics;
  timeoutMs: number;
  waitedMs: number;
  fallbackAllowed: boolean;
  fallbackUsed: boolean;
  strict: boolean;
}): ViewerLaunchDiagnostics {
  const launchedAttempt = input.attempts.find((attempt) => attempt.launched);
  const attemptedMethod = launchedAttempt?.method ?? input.attempts.find((attempt) => attempt.available)?.method;
  const fallbackReason = input.fallbackUsed
    ? 'native viewer heartbeat was not verified'
    : input.fallbackAllowed
      ? undefined
      : 'strict native mode forbids degraded fallback';

  return {
    attemptedMethod,
    attempts: input.attempts,
    heartbeat: input.heartbeat,
    timeoutMs: input.timeoutMs,
    waitedMs: input.waitedMs,
    failureReason: input.heartbeat.status === 'fresh' ? undefined : input.heartbeat.reason,
    fallbackDecision: input.fallbackUsed ? 'degraded' : 'none',
    fallback: {
      allowed: input.fallbackAllowed,
      used: input.fallbackUsed,
      method: input.fallbackUsed ? 'external-open' : undefined,
      reason: fallbackReason,
      strict: input.strict
    }
  };
}

export async function launchViewer(entryPath?: string, options: LaunchViewerOptions = {}): Promise<ViewerState> {
  const state = readState();
  const canOpen = Boolean(entryPath && fs.existsSync(entryPath));
  const requireNative = options.requireNative ?? nativeViewerRequiredByEnv();
  const expectedSurfaceId = options.expectedSurfaceId ?? state.activeSurfaceId;

  if (!canOpen) {
    const viewer = getViewerState(state);
    writeState({
      ...state,
      viewerMode: viewer.mode,
      viewerOpen: viewer.open,
      updatedAt: new Date().toISOString()
    });
    return viewer;
  }

  const knownPidPatterns = [
    viewerBinaryPath(),
    ...viewerAppBundleCandidates().map((candidate) => viewerAppExecutablePath(candidate))
  ];
  await stopStaleViewerSessions(knownPidPatterns, {
    ...state,
    activeSurfaceId: expectedSurfaceId
  });

  let viewer: ViewerState | null = null;
  let viewerMode: ViewerState['mode'] = 'closed';
  const configuredTimeoutMs = Number(process.env.MICROCANVAS_NATIVE_VIEWER_LAUNCH_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : 1500;
  let waitedMs = 0;
  let heartbeat: ViewerHeartbeatDiagnostics = {
    status: 'missing',
    expectedSurfaceId,
    reason: 'viewer heartbeat file is missing'
  };
  const launchResults = launchNativeViewer();
  const attempts = launchResults.map((result) => result.attempt);
  const launched = launchResults.find((result) => result.target && result.attempt.launched);

  if (launched?.target) {
    const result = await waitForNativeViewer(
      {
        ...state,
        activeSurfaceId: expectedSurfaceId
      },
      expectedSurfaceId,
      launched.target,
      timeoutMs
    );
    viewer = result.viewer;
    heartbeat = result.heartbeat;
    waitedMs = result.waitedMs;
    if (viewer?.mode === 'native') {
      viewerMode = 'native';
    }
  } else {
    const assessed = getMatchingNativeHeartbeat(
      {
        ...state,
        activeSurfaceId: expectedSurfaceId
      },
      expectedSurfaceId
    );
    heartbeat = assessed.heartbeat;
  }

  const fallbackAllowed = !requireNative;
  let fallbackUsed = false;
  if (viewerMode !== 'native' && fallbackAllowed && openPath(entryPath!)) {
    viewerMode = 'degraded';
    fallbackUsed = true;
  }

  viewer ??= buildViewerState(viewerMode, expectedSurfaceId);
  viewer = {
    ...viewer,
    launch: buildLaunchDiagnostics({
      attempts,
      heartbeat,
      timeoutMs,
      waitedMs,
      fallbackAllowed,
      fallbackUsed,
      strict: requireNative
    })
  };
  viewer.launchDiagnostics = viewer.launch;

  writeState({
    ...state,
    viewerMode: viewer.mode,
    viewerOpen: viewer.open,
    updatedAt: new Date().toISOString()
  });

  return viewer;
}
