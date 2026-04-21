import fs from 'node:fs';
import { paths } from './paths.js';
import {
  isViewerMode,
  viewerModeIsOpen,
  type RuntimeState
} from './manifest.js';

const defaultState = (): RuntimeState => ({
  activeSurfaceId: null,
  viewerMode: 'closed',
  viewerOpen: false,
  updatedAt: new Date().toISOString()
});

export function normalizeRuntimeState(state: Partial<RuntimeState> | null | undefined): RuntimeState {
  const viewerMode = isViewerMode(state?.viewerMode)
    ? state.viewerMode
    : state?.viewerOpen
      ? 'degraded'
      : 'closed';

  return {
    activeSurfaceId: typeof state?.activeSurfaceId === 'string' ? state.activeSurfaceId : null,
    viewerMode,
    viewerOpen: viewerModeIsOpen(viewerMode),
    updatedAt: typeof state?.updatedAt === 'string' ? state.updatedAt : new Date().toISOString()
  };
}

export function readState(): RuntimeState {
  if (!fs.existsSync(paths.stateFile)) return defaultState();
  return normalizeRuntimeState(JSON.parse(fs.readFileSync(paths.stateFile, 'utf8')) as Partial<RuntimeState>);
}

export function writeState(state: RuntimeState): void {
  fs.mkdirSync(paths.runtimeRoot, { recursive: true });
  fs.writeFileSync(paths.stateFile, JSON.stringify(normalizeRuntimeState(state), null, 2));
}
