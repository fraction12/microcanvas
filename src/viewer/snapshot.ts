import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { paths } from '../core/paths.js';
import { hasNativeViewerCapability } from './state.js';

interface SnapshotRequest {
  type: 'snapshot';
  requestId: string;
  snapshotPath: string;
  surfaceId: string;
  requestedAt: string;
}

interface SnapshotResponse {
  requestId: string;
  ok: boolean;
  snapshotPath?: string;
  error?: string;
  completedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestViewerSnapshot(surfaceId: string, timeoutMs = 5000): Promise<string> {
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
    requestedAt: new Date().toISOString()
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
        return response.snapshotPath;
      }
    }
    await sleep(100);
  }

  fs.rmSync(paths.viewerRequestFile, { force: true });
  throw new Error('timed out waiting for viewer snapshot');
}
