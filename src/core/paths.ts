import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json')) || fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate repository root');
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);
const runtimeRoot = path.join(repoRoot, 'runtime');

export const paths = {
  repoRoot,
  runtimeRoot,
  stateFile: path.join(runtimeRoot, 'state.json'),
  viewerStateFile: path.join(runtimeRoot, 'viewer-state.json'),
  viewerRequestFile: path.join(runtimeRoot, 'viewer-request.json'),
  viewerResponseFile: path.join(runtimeRoot, 'viewer-response.json'),
  lockFile: path.join(runtimeRoot, 'lock.json'),
  activeDir: path.join(runtimeRoot, 'active'),
  activeManifest: path.join(runtimeRoot, 'active', 'manifest.json'),
  stagingDir: path.join(runtimeRoot, 'staging'),
  snapshotsDir: path.join(runtimeRoot, 'snapshots')
};
