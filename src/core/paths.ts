import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const runtimeRoot = path.join(repoRoot, 'runtime');

export const paths = {
  repoRoot,
  runtimeRoot,
  stateFile: path.join(runtimeRoot, 'state.json'),
  lockFile: path.join(runtimeRoot, 'lock.json'),
  activeDir: path.join(runtimeRoot, 'active'),
  activeManifest: path.join(runtimeRoot, 'active', 'manifest.json'),
  stagingDir: path.join(runtimeRoot, 'staging'),
  snapshotsDir: path.join(runtimeRoot, 'snapshots')
};
