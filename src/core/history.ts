import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SurfaceManifest } from './manifest.js';

export const sourceHistoryLimit = 50;

export interface SourceHistoryEntry {
  originalPath: string;
  displayName: string;
  sourceFileName: string;
  sourceKind: SurfaceManifest['sourceKind'];
  renderMode: string;
  contentType: string;
  externalToRepo: boolean;
  lastShownAt: string;
  showCount: number;
}

export interface SourceHistoryFile {
  version: 1;
  updatedAt: string;
  entries: SourceHistoryEntry[];
}

export function sourceHistoryFilePath(): string {
  if (process.env.MICROCANVAS_SOURCE_HISTORY_FILE) {
    return path.resolve(process.env.MICROCANVAS_SOURCE_HISTORY_FILE);
  }

  const appSupportRoot = process.env.MICROCANVAS_APP_SUPPORT_DIR
    ? path.resolve(process.env.MICROCANVAS_APP_SUPPORT_DIR)
    : defaultAppSupportRoot();

  return path.join(appSupportRoot, 'source-history.json');
}

function defaultAppSupportRoot(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Microcanvas');
  }

  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, 'microcanvas');
  }

  return path.join(os.homedir(), '.local', 'share', 'microcanvas');
}

function normalizeHistoryFile(input: Partial<SourceHistoryFile> | null | undefined): SourceHistoryFile {
  const entries = Array.isArray(input?.entries)
    ? input.entries.flatMap((entry) => normalizeHistoryEntry(entry))
    : [];

  return {
    version: 1,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
    entries: dedupeAndCap(entries)
  };
}

function normalizeHistoryEntry(input: unknown): SourceHistoryEntry[] {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const entry = input as Partial<SourceHistoryEntry>;
  if (typeof entry.originalPath !== 'string' || !entry.originalPath) {
    return [];
  }

  const sourceFileName = typeof entry.sourceFileName === 'string' && entry.sourceFileName
    ? entry.sourceFileName
    : path.basename(entry.originalPath);

  return [{
    originalPath: entry.originalPath,
    displayName: typeof entry.displayName === 'string' && entry.displayName
      ? entry.displayName
      : sourceFileName,
    sourceFileName,
    sourceKind: isSurfaceSourceKind(entry.sourceKind) ? entry.sourceKind : 'artifact',
    renderMode: typeof entry.renderMode === 'string' && entry.renderMode ? entry.renderMode : 'unknown',
    contentType: typeof entry.contentType === 'string' && entry.contentType ? entry.contentType : 'application/octet-stream',
    externalToRepo: Boolean(entry.externalToRepo),
    lastShownAt: typeof entry.lastShownAt === 'string' && entry.lastShownAt
      ? entry.lastShownAt
      : new Date().toISOString(),
    showCount: typeof entry.showCount === 'number' && Number.isFinite(entry.showCount) && entry.showCount > 0
      ? Math.floor(entry.showCount)
      : 1
  }];
}

function isSurfaceSourceKind(value: unknown): value is SurfaceManifest['sourceKind'] {
  return value === 'html'
    || value === 'pdf'
    || value === 'artifact'
    || value === 'generated'
    || value === 'image'
    || value === 'table';
}

function dedupeAndCap(entries: SourceHistoryEntry[]): SourceHistoryEntry[] {
  const byPath = new Map<string, SourceHistoryEntry>();

  for (const entry of entries) {
    const existing = byPath.get(entry.originalPath);
    if (!existing || entry.lastShownAt >= existing.lastShownAt) {
      byPath.set(entry.originalPath, entry);
    }
  }

  return [...byPath.values()]
    .sort((a, b) => b.lastShownAt.localeCompare(a.lastShownAt))
    .slice(0, sourceHistoryLimit);
}

export function readSourceHistory(filePath = sourceHistoryFilePath()): SourceHistoryFile {
  if (!fs.existsSync(filePath)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: []
    };
  }

  try {
    return normalizeHistoryFile(JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<SourceHistoryFile>);
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: []
    };
  }
}

export function writeSourceHistory(history: SourceHistoryFile, filePath = sourceHistoryFilePath()): void {
  const normalized = normalizeHistoryFile(history);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
}

export function recordSourceHistoryFromManifest(manifest: SurfaceManifest, filePath = sourceHistoryFilePath()): SourceHistoryFile {
  const now = new Date().toISOString();
  const history = readSourceHistory(filePath);
  const existing = history.entries.find((entry) => entry.originalPath === manifest.source.originalPath);
  const nextEntry: SourceHistoryEntry = {
    originalPath: manifest.source.originalPath,
    displayName: manifest.title || manifest.source.sourceFileName,
    sourceFileName: manifest.source.sourceFileName,
    sourceKind: manifest.sourceKind,
    renderMode: manifest.renderMode,
    contentType: manifest.contentType,
    externalToRepo: manifest.source.externalToRepo,
    lastShownAt: now,
    showCount: (existing?.showCount ?? 0) + 1
  };

  const nextHistory = normalizeHistoryFile({
    version: 1,
    updatedAt: now,
    entries: [nextEntry, ...history.entries.filter((entry) => entry.originalPath !== manifest.source.originalPath)]
  });

  writeSourceHistory(nextHistory, filePath);
  return nextHistory;
}
