import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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

async function runCli(args) {
  const { stdout } = await execFileAsync('node', [cliPath, ...args], { cwd: repoRoot });
  return JSON.parse(stdout);
}

function resetRuntime() {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
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
  const updated = await runCli(['update', updateFile]);

  assert.equal(updated.ok, true);
  assert.equal(updated.surfaceId, shown.surfaceId);

  const verify = await runCli(['verify']);
  assert.equal(verify.ok, true);
  assert.equal(verify.surfaceId, shown.surfaceId);
});

test('snapshot writes a snapshot artifact for the active surface', async () => {
  const shown = await runCli(['show', insideFile]);
  const snapshot = await runCli(['snapshot']);

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
