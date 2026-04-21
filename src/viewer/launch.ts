import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readState, writeState } from '../core/state.js';

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
  const opened = canOpen && entryPath ? openPath(entryPath) : false;

  writeState({
    ...state,
    viewerOpen: opened,
    updatedAt: new Date().toISOString()
  });

  return { open: opened };
}
