import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { paths } from '../core/paths.js';
import { readState, writeState } from '../core/state.js';
import { getViewerOpenStatus } from './state.js';

function viewerPackageDir(): string {
  return path.join(paths.repoRoot, 'apps', 'macos-viewer', 'MicrocanvasViewer');
}

function viewerBinaryPath(): string {
  return path.join(viewerPackageDir(), '.build', 'arm64-apple-macosx', 'debug', 'MicrocanvasViewer');
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

function isViewerRunning(binaryPath: string): boolean {
  try {
    execFileSync('pgrep', ['-f', binaryPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function launchNativeViewerBinary(): boolean {
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
  try {
    execFileSync('open', [entryPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function launchViewer(entryPath?: string): Promise<{ open: boolean }> {
  const state = readState();
  const canOpen = Boolean(entryPath && fs.existsSync(entryPath));
  const launched = canOpen && entryPath
    ? launchNativeViewerBinary() || openPath(entryPath)
    : false;
  const open = launched || getViewerOpenStatus();

  writeState({
    ...state,
    viewerOpen: open,
    updatedAt: new Date().toISOString()
  });

  return { open };
}
