import fs from 'node:fs';
import { paths } from './paths.js';
import type { RuntimeState } from './manifest.js';

const defaultState = (): RuntimeState => ({
  activeSurfaceId: null,
  viewerOpen: false,
  updatedAt: new Date().toISOString()
});

export function readState(): RuntimeState {
  if (!fs.existsSync(paths.stateFile)) return defaultState();
  return JSON.parse(fs.readFileSync(paths.stateFile, 'utf8')) as RuntimeState;
}

export function writeState(state: RuntimeState): void {
  fs.mkdirSync(paths.runtimeRoot, { recursive: true });
  fs.writeFileSync(paths.stateFile, JSON.stringify(state, null, 2));
}
