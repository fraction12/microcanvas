import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const launchModulePath = path.join(repoRoot, 'dist', 'viewer', 'launch.js');
const runtimeRoot = path.join(repoRoot, 'runtime');
const activeDir = path.join(runtimeRoot, 'active');
const snapshotsDir = path.join(runtimeRoot, 'snapshots');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'microcanvas-native-contract-fixture-'));
const nativeContractFile = path.join(fixtureRoot, 'native-contract.md');

const launchSource = fs.existsSync(launchModulePath)
  ? fs.readFileSync(launchModulePath, 'utf8')
  : '';

const supportsLaunchContractControls = [
  'MICROCANVAS_NATIVE_VIEWER_APP_PATH',
  'MICROCANVAS_NATIVE_VIEWER_BINARY_PATH',
  'MICROCANVAS_EXTERNAL_OPEN_COMMAND',
  'launchDiagnostics'
].every((needle) => launchSource.includes(needle));

const supportsStrictNativeContract = supportsLaunchContractControls
  && (launchSource.includes('MICROCANVAS_REQUIRE_NATIVE_VIEWER') || launchSource.includes('--native'));

const serialContractTest = (name, supported, fn) => {
  test(name, {
    concurrency: false,
    skip: supported ? false : 'native launch diagnostics contract is not implemented in dist/viewer/launch.js yet'
  }, fn);
};

function resetRuntime() {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

function createLaunchSimulation() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microcanvas-native-contract-'));
  const binDir = path.join(root, 'bin');
  const openedPathLog = path.join(root, 'opened-path.txt');
  fs.mkdirSync(binDir, { recursive: true });

  const opener = path.join(binDir, 'open-external');
  fs.writeFileSync(opener, `#!/bin/sh\nprintf '%s\\n' "$1" > "${openedPathLog}"\nexit 0\n`);
  fs.chmodSync(opener, 0o755);

  return {
    root,
    openedPathLog,
    env: {
      MICROCANVAS_NATIVE_VIEWER_APP_PATH: path.join(root, 'missing', 'MicrocanvasViewer.app'),
      MICROCANVAS_NATIVE_VIEWER_BINARY_PATH: path.join(root, 'missing', 'MicrocanvasViewer'),
      MICROCANVAS_NATIVE_VIEWER_BUILD_COMMAND: path.join(root, 'missing-build-command'),
      MICROCANVAS_NATIVE_VIEWER_LAUNCH_TIMEOUT_MS: '25',
      MICROCANVAS_EXTERNAL_OPEN_COMMAND: opener
    }
  };
}

async function runCli(args, extraEnv = {}) {
  const { stdout } = await execFileAsync('node', [cliPath, ...args, '--json'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...extraEnv,
      MICROCANVAS_NATIVE_VIEWER_PID: String(process.pid)
    }
  });
  return JSON.parse(stdout);
}

function launchDiagnosticsFrom(result) {
  return result.record?.viewer?.launchDiagnostics
    ?? result.diagnostics?.nativeLaunch
    ?? result.nativeLaunchDiagnostics
    ?? result.error?.details?.launch
    ?? result.error?.diagnostics?.nativeLaunch
    ?? null;
}

function attemptedMethodsFrom(diagnostics) {
  return diagnostics.attemptedMethods
    ?? diagnostics.attempts?.map((attempt) => attempt.method)
    ?? [];
}

function assertLaunchDiagnostics(result, expectedFallbackDecision) {
  const diagnostics = launchDiagnosticsFrom(result);
  assert.ok(diagnostics, 'expected native launch diagnostics in the CLI result');

  const attemptedMethods = attemptedMethodsFrom(diagnostics);
  assert.equal(attemptedMethods[0], 'app-bundle');
  assert.ok(attemptedMethods.length >= 1, 'expected at least one launch attempt to be recorded');

  assert.match(JSON.stringify(diagnostics), /heartbeat/i);
  assert.match(JSON.stringify(diagnostics), /missing|stale|mismatch|timeout/i);
  assert.equal(diagnostics.fallbackDecision ?? diagnostics.fallback, expectedFallbackDecision);
  return diagnostics;
}

test.before(() => {
  fs.writeFileSync(nativeContractFile, '# Native launch contract\n\nFallback surface.\n');
});

test.beforeEach(() => {
  resetRuntime();
});

serialContractTest('show falls back to degraded display with native launch diagnostics when no heartbeat verifies', supportsLaunchContractControls, async () => {
  const simulation = createLaunchSimulation();

  const result = await runCli(['show', nativeContractFile], simulation.env);

  assert.equal(result.ok, true);
  assert.equal(result.record.viewer.mode, 'degraded');
  assert.equal(result.record.viewer.open, true);
  assert.equal(result.record.viewer.canVerify, false);
  assertLaunchDiagnostics(result, 'degraded');
  assert.ok(fs.existsSync(simulation.openedPathLog), 'expected degraded opener to be invoked');
});

serialContractTest('strict native show fails when no valid heartbeat appears', supportsStrictNativeContract, async () => {
  const simulation = createLaunchSimulation();

  const result = await runCli(['show', nativeContractFile], {
    ...simulation.env,
    MICROCANVAS_REQUIRE_NATIVE_VIEWER: '1'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'VIEWER_LAUNCH_FAILED');
  assert.match(result.error.message, /native viewer|heartbeat/i);
  assertLaunchDiagnostics(result, 'none');
  assert.equal(fs.existsSync(simulation.openedPathLog), false, 'strict native mode must not use degraded opener');
});
