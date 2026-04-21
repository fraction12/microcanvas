import fs from 'node:fs';
import { paths } from './paths.js';

export interface RuntimeLock {
  held: boolean;
  reason?: string;
}

export function readLock(): RuntimeLock {
  if (!fs.existsSync(paths.lockFile)) return { held: false };
  return JSON.parse(fs.readFileSync(paths.lockFile, 'utf8')) as RuntimeLock;
}

export function acquireLock(reason: string): RuntimeLock | null {
  const current = readLock();
  if (current.held) return current;
  const next: RuntimeLock = { held: true, reason };
  fs.mkdirSync(paths.runtimeRoot, { recursive: true });
  fs.writeFileSync(paths.lockFile, JSON.stringify(next, null, 2));
  return null;
}

export function releaseLock(): void {
  if (fs.existsSync(paths.lockFile)) {
    fs.rmSync(paths.lockFile);
  }
}
