import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getViewerOpenStatus } from '../dist/viewer/state.js';
import { requestViewerSnapshot } from '../dist/viewer/snapshot.js';

process.env.MICROCANVAS_NATIVE_VIEWER_PID = String(process.pid);

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const runtimeRoot = path.join(repoRoot, 'runtime');
const activeDir = path.join(runtimeRoot, 'active');
const snapshotsDir = path.join(runtimeRoot, 'snapshots');
const fixtureDir = path.join(repoRoot, 'test', 'fixtures');
const insideFile = path.join(fixtureDir, 'inside.md');
const updateFile = path.join(fixtureDir, 'updated.md');
const unsupportedFile = path.join(fixtureDir, 'unsupported.zip');
const csvFile = path.join(fixtureDir, 'sample-table.csv');
const pngImageFile = path.join(fixtureDir, 'test-image.png');
const jpgImageFile = path.join(fixtureDir, 'test-image.jpg');
const gifImageFile = path.join(fixtureDir, 'test-image.gif');
const webpImageFile = path.join(fixtureDir, 'test-image.webp');
const outsideFile = '/tmp/microcanvas-outside-test.txt';
const viewerStateFile = path.join(runtimeRoot, 'viewer-state.json');
const viewerRequestFile = path.join(runtimeRoot, 'viewer-request.json');
const viewerResponseFile = path.join(runtimeRoot, 'viewer-response.json');
const stateFile = path.join(runtimeRoot, 'state.json');

async function runCli(args) {
  const { stdout } = await execFileAsync('node', [cliPath, ...args, '--json'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MICROCANVAS_DISABLE_NATIVE_VIEWER: '1',
      MICROCANVAS_NATIVE_VIEWER_PID: String(process.pid)
    }
  });
  return JSON.parse(stdout);
}

async function runCliText(args) {
  const { stdout, stderr } = await execFileAsync('node', [cliPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MICROCANVAS_DISABLE_NATIVE_VIEWER: '1',
      MICROCANVAS_NATIVE_VIEWER_PID: String(process.pid)
    }
  });
  return { stdout, stderr };
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

function writeActiveManifest(surfaceId, overrides = {}) {
  fs.mkdirSync(activeDir, { recursive: true });
  fs.writeFileSync(path.join(activeDir, 'manifest.json'), JSON.stringify({
    surfaceId,
    title: 'Fixture surface',
    contentType: 'text/html',
    entryPath: 'index.html',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceKind: 'generated',
    renderMode: 'wkwebview',
    ...overrides
  }, null, 2));
}

function expectSuccess(result) {
  assert.equal(result.ok, true);
  assert.ok(result.record);
  assert.equal(typeof result.record, 'object');
  assert.equal(result.error ?? null, null);
  return result.record;
}

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.ok(result.error);
  assert.equal(result.error.code, code);
  assert.equal(typeof result.error.message, 'string');
  return result.error;
}

function assertDisplayRecord(record, expected) {
  assert.equal(record.surfaceId, expected.surfaceId);
  assert.equal(record.lock.held, false);
  assert.equal(record.artifacts.primary, expected.primaryArtifact);
  assert.ok(['native', 'degraded', 'closed'].includes(record.viewer.mode));
  assert.equal(typeof record.viewer.canVerify, 'boolean');
}

function assertDisplayVerification(result, viewerMode) {
  if (viewerMode === 'native') {
    assert.equal(result.verificationStatus, 'not_applicable');
    assert.deepEqual(result.warnings ?? [], []);
    return;
  }

  if (viewerMode === 'degraded') {
    assert.equal(result.verificationStatus, 'unverified');
    assert.equal(result.record.viewer.canVerify, false);
    assert.ok((result.warnings ?? []).length > 0);
    assert.match((result.warnings ?? []).join('\n'), /native viewer|degraded/i);
    assert.equal(typeof result.nextAction, 'string');
    return;
  }

  assert.equal(viewerMode, 'closed');
  assert.equal(result.verificationStatus, 'not_applicable');
  assert.equal(result.record.viewer.canVerify, false);
  assert.ok((result.warnings ?? []).length > 0);
  assert.match((result.warnings ?? []).join('\n'), /no viewer session|could be opened/i);
}

test.before(() => {
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(insideFile, '# Hello\n\nInside root fixture.\n');
  fs.writeFileSync(updateFile, '# Updated\n\nNew content.\n');
  fs.writeFileSync(unsupportedFile, 'not really a zip, but good enough for extension coverage\n');
  fs.writeFileSync(outsideFile, 'outside root\n');
});

test.beforeEach(() => {
  resetRuntime();
});

test('show renders and activates an inside-root markdown file with explicit viewer capability metadata', async () => {
  const result = await runCli(['show', insideFile]);
  const record = expectSuccess(result);

  assertDisplayRecord(record, {
    surfaceId: record.surfaceId,
    primaryArtifact: path.join(activeDir, 'index.html')
  });
  assertDisplayVerification(result, record.viewer.mode);

  const manifest = JSON.parse(fs.readFileSync(path.join(activeDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.entryPath, 'index.html');
  assert.equal(manifest.renderMode, 'wkwebview');
  assert.ok(fs.existsSync(path.join(activeDir, 'index.html')));

  const html = fs.readFileSync(path.join(activeDir, 'index.html'), 'utf8');
  assert.match(html, /<main class="surface-shell">/);
  assert.match(html, /<article class="surface-card">/);
  assert.match(html, /color-scheme:\s*light;/);
  assert.match(html, /color:\s*#17212b;/);
});

test('show renders and activates csv as a deterministic html table surface', async () => {
  const result = await runCli(['show', csvFile]);
  const record = expectSuccess(result);

  assertDisplayRecord(record, {
    surfaceId: record.surfaceId,
    primaryArtifact: path.join(activeDir, 'index.html')
  });
  assertDisplayVerification(result, record.viewer.mode);

  const manifest = JSON.parse(fs.readFileSync(path.join(activeDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.entryPath, 'index.html');
  assert.equal(manifest.renderMode, 'wkwebview');
  assert.equal(manifest.sourceKind, 'table');
  assert.equal(manifest.contentType, 'text/html');

  const html = fs.readFileSync(path.join(activeDir, 'index.html'), 'utf8');
  assert.match(html, /<main class="surface-shell surface-shell--table">/);
  assert.match(html, /<div class="table-scroll">/);
  assert.match(html, /<table class="data-table">/);
  assert.match(html, /color:\s*#17212b;/);
  assert.match(html, /<thead><tr><th scope="col">name<\/th><th scope="col">role<\/th><th scope="col">notes<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td>Dushyant<\/td><td>owner<\/td><td>Keeps scope tight<\/td><\/tr>/);
  assert.match(html, /Uses &quot;escaped quotes&quot; cleanly/);
});

test('show renders and activates supported image files across formats', async () => {
  const cases = [
    { file: pngImageFile, entryPath: 'test-image.png', contentType: 'image/png' },
    { file: jpgImageFile, entryPath: 'test-image.jpg', contentType: 'image/jpeg' },
    { file: gifImageFile, entryPath: 'test-image.gif', contentType: 'image/gif' },
    { file: webpImageFile, entryPath: 'test-image.webp', contentType: 'image/webp' }
  ];

  for (const testCase of cases) {
    resetRuntime();
    const result = await runCli(['show', testCase.file]);
    const record = expectSuccess(result);

    assertDisplayRecord(record, {
      surfaceId: record.surfaceId,
      primaryArtifact: path.join(activeDir, testCase.entryPath)
    });
    assertDisplayVerification(result, record.viewer.mode);

    const manifest = JSON.parse(fs.readFileSync(path.join(activeDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.entryPath, testCase.entryPath);
    assert.equal(manifest.renderMode, 'image');
    assert.equal(manifest.sourceKind, 'image');
    assert.equal(manifest.contentType, testCase.contentType);
    assert.ok(fs.existsSync(path.join(activeDir, testCase.entryPath)));
  }
});

test('render keeps adapter-backed staging behavior stable across supported families', async () => {
  const cases = [
    {
      file: insideFile,
      entryPath: 'index.html',
      renderMode: 'wkwebview',
      sourceKind: 'generated',
      contentType: 'text/html'
    },
    {
      file: csvFile,
      entryPath: 'index.html',
      renderMode: 'wkwebview',
      sourceKind: 'table',
      contentType: 'text/html'
    },
    {
      file: pngImageFile,
      entryPath: 'test-image.png',
      renderMode: 'image',
      sourceKind: 'image',
      contentType: 'image/png'
    }
  ];

  for (const testCase of cases) {
    resetRuntime();
    const result = await runCli(['render', testCase.file]);
    const record = expectSuccess(result);

    assert.ok(record.surfaceId);
    assert.ok(record.artifacts.primary);

    const stagingDir = path.dirname(record.artifacts.primary);
    const manifest = JSON.parse(fs.readFileSync(path.join(stagingDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.entryPath, testCase.entryPath);
    assert.equal(manifest.renderMode, testCase.renderMode);
    assert.equal(manifest.sourceKind, testCase.sourceKind);
    assert.equal(manifest.contentType, testCase.contentType);
    assert.ok(fs.existsSync(path.join(stagingDir, testCase.entryPath)));
  }
});

test('update preserves the active surface id and reports whether the viewer is native or degraded', async () => {
  const shown = await runCli(['show', insideFile]);
  const shownRecord = expectSuccess(shown);

  if (shownRecord.viewer.mode === 'native') {
    writeViewerState({
      pid: process.pid,
      lastSeenAt: new Date().toISOString(),
      activeSurfaceId: shownRecord.surfaceId
    });
  }

  const updated = await runCli(['update', updateFile]);
  const updatedRecord = expectSuccess(updated);

  assert.equal(updatedRecord.surfaceId, shownRecord.surfaceId);
  assertDisplayVerification(updated, updatedRecord.viewer.mode);

  if (updatedRecord.viewer.mode === 'native') {
    writeViewerState({
      pid: process.pid,
      lastSeenAt: new Date().toISOString(),
      activeSurfaceId: shownRecord.surfaceId
    });
    const verify = await runCli(['verify']);
    const verifyRecord = expectSuccess(verify);
    assert.equal(verifyRecord.surfaceId, shownRecord.surfaceId);
    assert.equal(verify.verificationStatus, 'verified');
  } else {
    const verify = await runCli(['verify']);
    const error = expectFailure(verify, 'VERIFY_FAILED');
    if (updatedRecord.viewer.mode === 'degraded') {
      assert.match(error.message, /native viewer|degraded/i);
    } else {
      assert.equal(updatedRecord.viewer.mode, 'closed');
      assert.match(error.message, /viewer is not confirmed open/i);
    }
  }
});

test('snapshot writes a snapshot artifact for the active surface when native viewer capability is available', async () => {
  const shown = await runCli(['show', insideFile]);
  const shownRecord = expectSuccess(shown);

  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shownRecord.surfaceId
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
  assert.equal(request.expectedViewerPid, process.pid);
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    captureState: 'fresh',
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshot = await pending;
  const record = expectSuccess(snapshot);
  assert.equal(record.surfaceId, shownRecord.surfaceId);
  assert.ok(record.artifacts.snapshot);
  assert.ok(fs.existsSync(record.artifacts.snapshot));
  assert.equal(snapshot.verificationStatus, 'verified');
});

test('outside-root file is rejected through AgentTK failure metadata', async () => {
  const result = await runCli(['show', outsideFile]);
  const error = expectFailure(result, 'INVALID_INPUT');
  assert.match(error.message, /Path escapes allowed roots/);
});

test('unsupported file types fail honestly with UNSUPPORTED_CONTENT', async () => {
  const result = await runCli(['show', unsupportedFile]);
  const error = expectFailure(result, 'UNSUPPORTED_CONTENT');
  assert.match(error.message, /Supported today: html, md, pdf, csv, png, jpg, jpeg, gif, webp, txt, json, js, ts/);
});

test('status reports native viewer mode when heartbeat is fresh and pid is alive', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-native',
    viewerMode: 'native',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-native');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>native</body></html>');
  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: 'surface-native'
  });

  assert.equal(getViewerOpenStatus(), true);
  const status = await runCli(['status']);
  const record = expectSuccess(status);
  assert.equal(record.surfaceId, 'surface-native');
  assert.equal(record.viewer.mode, 'native');
  assert.equal(record.viewer.canVerify, true);
  assert.equal(record.viewer.open, true);
});

test('status reports degraded mode and disabled verification capability when only external-open fallback is recorded', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-degraded',
    viewerMode: 'degraded',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-degraded');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>degraded</body></html>');

  const status = await runCli(['status']);
  const record = expectSuccess(status);
  assert.equal(record.surfaceId, 'surface-degraded');
  assert.equal(record.viewer.mode, 'degraded');
  assert.equal(record.viewer.canVerify, false);
  assert.equal(record.viewer.open, true);
  assert.equal(record.artifacts.primary, path.join(activeDir, 'index.html'));
});

test('verify fails when only degraded viewer mode is available', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-stale',
    viewerMode: 'degraded',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-stale');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>stale</body></html>');

  const verify = await runCli(['verify']);
  const error = expectFailure(verify, 'VERIFY_FAILED');
  assert.match(error.message, /native viewer|degraded/i);
});

test('snapshot fails clearly when only degraded viewer mode is available', async () => {
  writeRuntimeState({
    activeSurfaceId: 'surface-degraded',
    viewerMode: 'degraded',
    viewerOpen: true,
    updatedAt: new Date().toISOString()
  });
  writeActiveManifest('surface-degraded');
  fs.writeFileSync(path.join(activeDir, 'index.html'), '<html><body>degraded</body></html>');

  const snapshot = await runCli(['snapshot']);
  const error = expectFailure(snapshot, 'VERIFY_FAILED');
  assert.match(error.message, /native viewer|degraded/i);
});

test('snapshot succeeds with degraded capture readiness from a native viewer handshake', async () => {
  const shown = await runCli(['show', insideFile]);
  const shownRecord = expectSuccess(shown);

  writeViewerState({
    pid: process.pid,
    lastSeenAt: new Date().toISOString(),
    activeSurfaceId: shownRecord.surfaceId
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
    captureState: 'degraded',
    warning: 'Snapshot captured while capture readiness was degraded.',
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshot = await pending;
  const record = expectSuccess(snapshot);
  assert.equal(snapshot.verificationStatus, 'unverified');
  assert.equal(record.surfaceId, shownRecord.surfaceId);
  assert.equal(record.viewer.mode, 'native');
  assert.equal(record.viewer.canVerify, true);
  assert.ok(record.artifacts.snapshot);
  assert.ok(fs.existsSync(record.artifacts.snapshot));
  assert.ok((snapshot.warnings ?? []).length > 0);
  assert.match((snapshot.warnings ?? []).join('\n'), /capture readiness was degraded/i);
  assert.match(record.message, /capture readiness was degraded/i);
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
  assert.equal(request.expectedViewerPid, process.pid);
  fs.writeFileSync(request.snapshotPath, 'fake-png-data');
  fs.writeFileSync(viewerResponseFile, JSON.stringify({
    requestId: request.requestId,
    ok: true,
    captureState: 'fresh',
    snapshotPath: request.snapshotPath,
    completedAt: new Date().toISOString()
  }, null, 2));

  const snapshot = await pending;
  assert.equal(snapshot.snapshotPath, request.snapshotPath);
  assert.equal(snapshot.captureState, 'fresh');
  assert.equal(snapshot.warning, undefined);
  assert.ok(fs.existsSync(snapshot.snapshotPath));
});

test('human help output is command-aware', async () => {
  const rootHelp = await runCliText(['--help']);
  assert.match(rootHelp.stdout, /microcanvas/);
  assert.match(rootHelp.stdout, /show - Activate a staged surface or render and show a source file/);

  const renderHelp = await runCliText(['render', '--help']);
  assert.match(renderHelp.stdout, /Usage: microcanvas render <path>/);
});
