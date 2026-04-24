export interface SurfaceSourceInfo {
  originalPath: string;
  sourceFileName: string;
  stagedPath: string;
  stagedRelativePath: string;
  ingestedAt: string;
  externalToRepo: boolean;
}

export interface SurfaceManifest {
  surfaceId: string;
  title: string;
  contentType: string;
  entryPath: string;
  createdAt: string;
  updatedAt: string;
  sourceKind: 'html' | 'pdf' | 'artifact' | 'generated' | 'image' | 'table';
  renderMode: string;
  source: SurfaceSourceInfo;
}

export type ViewerMode = 'closed' | 'degraded' | 'native';

export function isViewerMode(value: unknown): value is ViewerMode {
  return value === 'closed' || value === 'degraded' || value === 'native';
}

export function viewerModeIsOpen(mode: ViewerMode): boolean {
  return mode !== 'closed';
}

export function viewerModeHasVerificationCapability(mode: ViewerMode): boolean {
  return mode === 'native';
}

export interface RuntimeState {
  activeSurfaceId: string | null;
  viewerMode: ViewerMode;
  viewerOpen: boolean;
  updatedAt: string;
}

export interface ViewerState {
  mode: ViewerMode;
  open: boolean;
  verificationCapable: boolean;
  pid?: number;
  lastSeenAt?: string;
  activeSurfaceId?: string | null;
  launch?: ViewerLaunchDiagnostics;
  launchDiagnostics?: ViewerLaunchDiagnostics;
}

export type NativeViewerLaunchMethod = 'app-bundle' | 'swiftpm-binary';

export type ViewerHeartbeatStatus =
  | 'missing'
  | 'invalid'
  | 'stale'
  | 'pid_not_running'
  | 'pid_mismatch'
  | 'surface_mismatch'
  | 'fresh';

export interface ViewerHeartbeatDiagnostics {
  status: ViewerHeartbeatStatus;
  pid?: number;
  lastSeenAt?: string;
  ageMs?: number;
  activeSurfaceId?: string | null;
  expectedSurfaceId?: string | null;
  reason?: string;
}

export interface ViewerLaunchAttempt {
  method: NativeViewerLaunchMethod;
  path?: string;
  available: boolean;
  launched: boolean;
  reused?: boolean;
  reason?: string;
  error?: string;
}

export interface ViewerLaunchDiagnostics {
  attemptedMethod?: NativeViewerLaunchMethod;
  attempts: ViewerLaunchAttempt[];
  heartbeat: ViewerHeartbeatDiagnostics;
  timeoutMs: number;
  waitedMs: number;
  failureReason?: string;
  fallbackDecision: 'degraded' | 'none';
  fallback: {
    allowed: boolean;
    used: boolean;
    method?: 'external-open';
    reason?: string;
    strict: boolean;
  };
}

export function createManifest(input: {
  surfaceId: string;
  title: string;
  contentType: string;
  entryPath: string;
  sourceKind: SurfaceManifest['sourceKind'];
  renderMode: string;
  source: SurfaceSourceInfo;
}): SurfaceManifest {
  const now = new Date().toISOString();
  return {
    surfaceId: input.surfaceId,
    title: input.title,
    contentType: input.contentType,
    entryPath: input.entryPath,
    createdAt: now,
    updatedAt: now,
    sourceKind: input.sourceKind,
    renderMode: input.renderMode,
    source: input.source
  };
}
