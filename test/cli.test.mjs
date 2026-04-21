import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getViewerOpenStatus } from '../dist/viewer/state.js';
import { requestViewerSnapshot } from '../dist/viewer/snapshot.js';

const execFileAsync = promisify(execFile);
const repoRoot = '/Volumes/MacSSD/Projects/microcanvas';
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const runtimeRoot = path.join(repoRoot, 'runtime');
const activeDir = path.join(runtimeRoot, 'active');
const snapshotsDir = path.join(runtimeRoot, 'snapshots');
const fixtureDir = path.join(repoRoot, 'test', 'fixtures');
const insideFile = path.join(fixtureDir, 'inside.md');
const updateFile = path.join(fixtureDir, 'updated.md');
const outsideFile = '/tmp/microcanvas-outside-test.txt';
const viewerStateFile = path.join(runtimeRoot, 'viewer-state.json');
const viewerRequestFile = path.join(runtimeRoot, 'viewer-request.json');
const viewerResponseFile = path.join(runtimeRoot, 'viewer-response.json');
const stateFile = path.join(runtimeRoot, 'state.json');

async function runCli(args) {
  const { stdout } = await execFileAsync('node', [cliPath, ...args], { cwd: repoRoot });
  return JSON.parse(stdout);
}

function resetRuntime() {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

function writeViewerState(state) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(viewerStateFile, JSON.stringify(state, null, 2));
}

function writeRuntimeState(state) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

test.before(() => {
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(insideFile, '# Hello\n\nInside root fixture.\n');
  fs.writeFileSync(updateFile, '# Updated\n\nNew content.\n');
  fs.writeFileSync(outsideFile, 'outside root\n');
});

test.beforeEach(() => {
  resetRuntime();
});

test('show renders and activates an inside-root markdown file', async () => {
  const result = await runCli(['show', insideFile]);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.viewer.open, true);

  const manifest = JSON.parse(fs.readFileSync(path.join(activeDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.entryPath, 'index.html');
  assert.equal(manifest.renderMode, 'wkwebview');
  assert.ok(fs.existsSync(path.join(activeDir, 'index.html')));
});

test('update preserves the active surface id', async () => {
  const shown = await runCli(['show', insideFile]);
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shown.surfaceId
  });
  const updated = await runCli(['update', updateFile]);

  assert.equal(updated.ok, true);
  assert.equal(updated.surfaceId, shown.surfaceId);

  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shown.surfaceId
  });
  const verify = await runCli(['verify']);
  assert.equal(verify.ok, true);
  assert.equal(verify.surfaceId, shown.surfaceId);
});

test('snapshot writes a snapshot artifact for the active surface', async () => {
  const shown = await runCli(['show', insideFile]);
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shown.surfaceId
  });

  const pending = runCli(['snapshot']);

  let request;
  for (let i = 0; i < 20; i += 1) {
    if (fs.existsSync(viewerRequestFile)) {
      request = JSON.parse(fs.readFileSync(viewerRequestFile, 'utf8'));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.ok(request);
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshot = await pending;
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.surfaceId, shown.surfaceId);
  assert.ok(snapshot.artifacts.snapshot);
  assert.ok(fs.existsSync(snapshot.artifacts.snapshot));
});

test('outside-root file is rejected as INVALID_INPUT', async () => {
  const result = await runCli(['show', outsideFile]);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_INPUT');
  assert.match(result.message, /Path escapes allowed roots/);
});

test('status reports viewer open when heartbeat is fresh and pid is alive', async () => {
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: null
  });

  assert.equal(getViewerOpenStatus(), true);
  const status = await runCli(['status']);
  assert.equal(status.viewer.open, true);
});

test('verify fails when viewer heartbeat is stale', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-stale',
    viewerOpen: false,
    updatedAt: new Date().toISOString()
  });
  fs.mkdirSync(activeDir, { recursive: true });
  fs.writeFileSync(path.join(activeDir, 'manifest.json'), JSON.stringify({
    surfaceId: 'surface-stale',
    title: 'Stale surface',
    contentType: 'text/html',
    entryPath: 'index.html',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceKind: 'generated',
    renderMode: 'wkwebview'
  }, null, 2));
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>stale</body></html>');
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date(Date.now() - 60_000).toISOString(),
    activeSurfaceId: 'surface-stale'
  });

  const verify = await runCli(['verify']);
  assert.equal(verify.ok, false);
  assert.equal(verify.code, 'VERIFY_FAILED');
  assert.match(verify.message, /viewer is not confirmed open/);
});

test('requestViewerSnapshot writes request and resolves response handshake', async () => {
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: 'surface-test'
  });

  const pending = requestViewerSnapshot('surface-test', 2000);

  let request;
  for (let i = 0; i < 20; i += 1) {
    if (fs.existsSync(viewerRequestFile)) {
      request = JSON.parse(fs.readFileSync(viewerRequestFile, 'utf8'));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.ok(request);
  assert.equal(request.type, 'snapshot');
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshotPath = await pending;
  assert.equal(snapshotPath, request.snapshotPath);
  assert.ok(fs.existsSync(snapshotPath));
});
