import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { paths } from '../core/paths.js';
import { hasNativeViewerCapability } from './state.js';

export type SnapshotCaptureState = 'fresh' | 'degraded';

interface SnapshotRequest {
  type: 'snapshot';
  requestId: string;
  snapshotPath: string;
  surfaceId: string;
  requestedAt: string;
  expectedViewerPid?: number;
}

interface SnapshotResponse {
  requestId: string;
  ok: boolean;
  snapshotPath?: string;
  captureState?: SnapshotCaptureState;
  warning?: string;
  error?: string;
  completedAt: string;
}

export interface ViewerSnapshot {
  snapshotPath: string;
  captureState: SnapshotCaptureState;
  warning?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectedNativeViewerPid(): number | null {
  const raw = process.env.MICROCANVAS_NATIVE_VIEWER_PID;
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function requestViewerSnapshot(surfaceId: string, timeoutMs = 5000): Promise<ViewerSnapshot> {
  if (!hasNativeViewerCapability()) {
    throw new Error('native viewer-backed snapshot capability is unavailable');
  }

  fs.mkdirSync(paths.snapshotsDir, { recursive: true });
  fs.mkdirSync(paths.runtimeRoot, { recursive: true });

  const requestId = crypto.randomUUID();
  const snapshotPath = path.join(paths.snapshotsDir, `${surfaceId}.png`);
  const request: SnapshotRequest = {
    type: 'snapshot',
    requestId,
    snapshotPath,
    surfaceId,
    requestedAt: new Date().toISOString(),
    expectedViewerPid: expectedNativeViewerPid() ?? undefined
  };

  fs.rmSync(paths.viewerResponseFile, { force: true });
  fs.writeFileSync(paths.viewerRequestFile, JSON.stringify(request, null, 2));

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(paths.viewerResponseFile)) {
      const response = JSON.parse(fs.readFileSync(paths.viewerResponseFile, 'utf8')) as SnapshotResponse;
      if (response.requestId === requestId) {
        fs.rmSync(paths.viewerRequestFile, { force: true });
        fs.rmSync(paths.viewerResponseFile, { force: true });
        if (!response.ok || !response.snapshotPath) {
          throw new Error(response.error ?? 'viewer snapshot failed');
        }
        return {
          snapshotPath: response.snapshotPath,
          captureState: response.captureState ?? 'fresh',
          warning: response.warning
        };
      }
    }
    await sleep(100);
  }

  fs.rmSync(paths.viewerRequestFile, { force: true });
  throw new Error('timed out waiting for viewer snapshot');
}
