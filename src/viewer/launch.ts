import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { viewerModeIsOpen, type RuntimeState, type ViewerState } from '../core/manifest.js';
import { paths } from '../core/paths.js';
import { readState, writeState } from '../core/state.js';
import { getViewerState, readViewerRuntimeState } from './state.js';

function viewerPackageDir(): string {
  return path.join(paths.repoRoot, 'apps', 'macos-viewer', 'MicrocanvasViewer');
}

function viewerBinaryPath(): string {
  return path.join(viewerPackageDir(), '.build', 'arm64-apple-macosx', 'debug', 'MicrocanvasViewer');
}

function nativeViewerLaunchDisabled(): boolean {
  return process.env.MICROCANVAS_DISABLE_NATIVE_VIEWER === '1';
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

async function stopStaleViewerSessions(binaryPath: string, runtimeState: RuntimeState): Promise<void> {
  const runtimeViewer = readViewerRuntimeState();
  if (!runtimeViewer) {
    return;
  }

  const pids = findViewerPids(binaryPath);
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
    const remaining = findViewerPids(binaryPath);
    if (remaining.length === 0) {
      break;
    }
    await sleep(50);
  }

  fs.rmSync(paths.viewerStateFile, { force: true });
}

function launchNativeViewerBinary(): boolean {
  if (nativeViewerLaunchDisabled()) {
    return false;
  }

  if (!ensureNativeViewerBuilt()) {
    return false;
  }

  const binary = viewerBinaryPath();
  if (isViewerRunning(binary)) {
    return true;
  }

  try {
    const child = spawn(binary, ['--repo-root', paths.repoRoot], {
      cwd: paths.repoRoot,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function openPath(entryPath: string): boolean {
  if (nativeViewerLaunchDisabled()) {
    return false;
  }

  try {
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

export async function launchViewer(entryPath?: string): Promise<ViewerState> {
  const state = readState();
  const canOpen = Boolean(entryPath && fs.existsSync(entryPath));

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

  const binary = viewerBinaryPath();
  await stopStaleViewerSessions(binary, state);

  let viewerMode: ViewerState['mode'] = 'closed';

  if (launchNativeViewerBinary()) {
    const viewer = getViewerState(state);
    if (viewer.mode === 'native') {
      viewerMode = 'native';
    }
  }

  if (viewerMode !== 'native' && openPath(entryPath!)) {
    viewerMode = 'degraded';
  }

  const viewer = buildViewerState(viewerMode, state.activeSurfaceId);

  writeState({
    ...state,
    viewerMode,
    viewerOpen: viewer.open,
    updatedAt: new Date().toISOString()
  });

  return viewer;
}
