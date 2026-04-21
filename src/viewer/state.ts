import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { paths } from '../core/paths.js';

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

export function getViewerOpenStatus(maxAgeMs = 5000): boolean {
  const state = readViewerRuntimeState();
  if (!state) return false;
  const ageMs = Date.now() - Date.parse(state.lastSeenAt);
  if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) return false;
  return isPidRunning(state.pid);
}
