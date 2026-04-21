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
