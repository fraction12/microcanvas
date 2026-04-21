import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import { paths } from './paths.js';
import type { SurfaceManifest } from './manifest.js';
import { createManifest } from './manifest.js';

export interface RenderInput {
  sourcePath: string;
  title?: string;
  surfaceId?: string;
}

export interface RenderedSurface {
  manifest: SurfaceManifest;
  stagingDir: string;
  primaryArtifact: string;
}

type SurfaceTransform = 'markdown-to-html' | 'csv-to-html-table';

type Detection = {
  contentType: string;
  sourceKind: SurfaceManifest['sourceKind'];
  renderMode: string;
  targetName: string;
  transform?: SurfaceTransform;
};

type SurfaceAdapter = Detection & {
  extensions: string[];
};

function unsupportedContent(message: string): never {
  throw new Error(`UNSUPPORTED_CONTENT: ${message}`);
}

const allowedRoots = [paths.repoRoot];

const surfaceAdapters: SurfaceAdapter[] = [
  {
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    sourceKind: 'html',
    renderMode: 'wkwebview',
    targetName: 'index.html'
  },
  {
    extensions: ['.md', '.markdown'],
    contentType: 'text/html',
    sourceKind: 'generated',
    renderMode: 'wkwebview',
    targetName: 'index.html',
    transform: 'markdown-to-html'
  },
  {
    extensions: ['.pdf'],
    contentType: 'application/pdf',
    sourceKind: 'pdf',
    renderMode: 'pdf',
    targetName: '{basename}'
  },
  {
    extensions: ['.csv'],
    contentType: 'text/html',
    sourceKind: 'table',
    renderMode: 'wkwebview',
    targetName: 'index.html',
    transform: 'csv-to-html-table'
  },
  {
    extensions: ['.png'],
    contentType: 'image/png',
    sourceKind: 'image',
    renderMode: 'image',
    targetName: '{basename}'
  },
  {
    extensions: ['.jpg', '.jpeg'],
    contentType: 'image/jpeg',
    sourceKind: 'image',
    renderMode: 'image',
    targetName: '{basename}'
  },
  {
    extensions: ['.gif'],
    contentType: 'image/gif',
    sourceKind: 'image',
    renderMode: 'image',
    targetName: '{basename}'
  },
  {
    extensions: ['.webp'],
    contentType: 'image/webp',
    sourceKind: 'image',
    renderMode: 'image',
    targetName: '{basename}'
  },
  {
    extensions: ['.txt', '.json', '.js', '.ts'],
    contentType: 'text/html',
    sourceKind: 'generated',
    renderMode: 'wkwebview',
    targetName: 'index.html',
    transform: 'markdown-to-html'
  }
];

function ensureSafeResolvedPath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  const real = fs.realpathSync(resolved);

  const insideAllowedRoot = allowedRoots.some((root) => {
    const realRoot = fs.realpathSync(root);
    return real === realRoot || real.startsWith(`${realRoot}${path.sep}`);
  });

  if (!insideAllowedRoot) {
    throw new Error(`Path escapes allowed roots: ${inputPath}`);
  }

  const stats = fs.lstatSync(real);
  if (stats.isSymbolicLink()) {
    throw new Error(`Symlink paths are not allowed: ${inputPath}`);
  }

  return real;
}

function resolveTargetName(adapter: SurfaceAdapter, sourcePath: string): string {
  return adapter.targetName === '{basename}' ? path.basename(sourcePath) : adapter.targetName;
}

function detectContentType(sourcePath: string): Detection {
  const ext = path.extname(sourcePath).toLowerCase();
  const adapter = surfaceAdapters.find((candidate) => candidate.extensions.includes(ext));

  if (!adapter) {
    unsupportedContent(`Unsupported content type for ${path.basename(sourcePath)}. Supported today: html, md, pdf, csv, png, jpg, jpeg, gif, webp, txt, json, js, ts.`);
  }

  return {
    contentType: adapter.contentType,
    sourceKind: adapter.sourceKind,
    renderMode: adapter.renderMode,
    targetName: resolveTargetName(adapter, sourcePath),
    transform: adapter.transform
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (inQuotes) {
    throw new Error('UNSUPPORTED_CONTENT: CSV contains an unterminated quoted field.');
  }

  cells.push(current);
  return cells;
}

function parseCsv(raw: string): string[][] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.length === 0) {
    return [];
  }

  const rows: string[][] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        currentLine += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      rows.push(parseCsvRow(currentLine));
      currentLine = '';
      continue;
    }

    currentLine += char;
  }

  if (inQuotes) {
    throw new Error('UNSUPPORTED_CONTENT: CSV contains an unterminated quoted field.');
  }

  if (currentLine.length > 0 || normalized.endsWith('\n')) {
    rows.push(parseCsvRow(currentLine));
  }

  return rows;
}

function renderCsvTable(title: string, raw: string): string {
  const rows = parseCsv(raw);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);

  const normalizedRows = rows.map((row) => {
    const cells = row.slice();
    while (cells.length < width) {
      cells.push('');
    }
    return cells;
  });

  const header = normalizedRows[0] ?? [];
  const bodyRows = normalizedRows.slice(1);
  const tableHeader = header.length > 0
    ? `<thead><tr>${header.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const tableBody = bodyRows.length > 0
    ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '';
  const empty = normalizedRows.length === 0 ? '<p class="table-empty">CSV file is empty.</p>' : '';

  return buildHtmlDocument(title, `${empty}<table class="data-table">${tableHeader}${tableBody}</table>`);
}

function buildHtmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        max-width: 860px;
        margin: 40px auto;
        padding: 0 20px 60px;
        line-height: 1.6;
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      pre {
        padding: 16px;
        border-radius: 10px;
        overflow-x: auto;
        background: rgba(127, 127, 127, 0.12);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 24px 0;
      }
      th, td {
        padding: 10px 12px;
        border: 1px solid rgba(127, 127, 127, 0.3);
        text-align: left;
        vertical-align: top;
      }
      th {
        background: rgba(127, 127, 127, 0.12);
      }
      .table-empty {
        font-style: italic;
        opacity: 0.8;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

async function materializeArtifact(resolvedSource: string, targetPath: string, detected: Detection, title: string): Promise<void> {
  if (detected.transform === 'markdown-to-html') {
    const raw = fs.readFileSync(resolvedSource, 'utf8');
    const rendered = await marked.parse(path.extname(resolvedSource).toLowerCase() === '.md' || path.extname(resolvedSource).toLowerCase() === '.markdown'
      ? raw
      : `\`\`\`\n${raw}\n\`\`\``);
    const html = buildHtmlDocument(title, rendered);
    fs.writeFileSync(targetPath, html);
    return;
  }

  if (detected.transform === 'csv-to-html-table') {
    const raw = fs.readFileSync(resolvedSource, 'utf8');
    const html = renderCsvTable(title, raw);
    fs.writeFileSync(targetPath, html);
    return;
  }

  fs.copyFileSync(resolvedSource, targetPath);
}

export function ensureRuntimeLayout(): void {
  fs.mkdirSync(paths.runtimeRoot, { recursive: true });
  fs.mkdirSync(paths.activeDir, { recursive: true });
  fs.mkdirSync(paths.stagingDir, { recursive: true });
  fs.mkdirSync(paths.snapshotsDir, { recursive: true });
}

export async function renderSurface(input: RenderInput): Promise<RenderedSurface> {
  ensureRuntimeLayout();

  let resolvedSource: string;
  try {
    resolvedSource = ensureSafeResolvedPath(input.sourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid source path';
    if (message.startsWith('UNSUPPORTED_CONTENT:')) {
      throw new Error(message);
    }
    throw new Error(`INVALID_INPUT: ${message}`);
  }
  const title = input.title ?? path.basename(resolvedSource);
  const surfaceId = input.surfaceId ?? crypto.randomUUID();
  const stageDir = path.join(paths.stagingDir, surfaceId);
  const assetsDir = path.join(stageDir, 'assets');
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const detected = detectContentType(resolvedSource);
  const targetPath = path.join(stageDir, detected.targetName);
  await materializeArtifact(resolvedSource, targetPath, detected, title);

  const manifest = createManifest({
    surfaceId,
    title,
    contentType: detected.contentType,
    entryPath: detected.targetName,
    sourceKind: detected.sourceKind,
    renderMode: detected.renderMode
  });

  fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return {
    manifest,
    stagingDir: stageDir,
    primaryArtifact: targetPath
  };
}

export function getStagedSurface(surfaceId: string): { manifest: SurfaceManifest; stagingDir: string; primaryArtifact: string } {
  const stageDir = path.join(paths.stagingDir, surfaceId);
  const manifestPath = path.join(stageDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Staged surface not found: ${surfaceId}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SurfaceManifest;
  return {
    manifest,
    stagingDir: stageDir,
    primaryArtifact: path.join(stageDir, manifest.entryPath)
  };
}

export function getActiveSurface(): { manifest: SurfaceManifest; primaryArtifact: string } {
  if (!fs.existsSync(paths.activeManifest)) {
    throw new Error('No active surface');
  }
  const manifest = JSON.parse(fs.readFileSync(paths.activeManifest, 'utf8')) as SurfaceManifest;
  return {
    manifest,
    primaryArtifact: path.join(paths.activeDir, manifest.entryPath)
  };
}

export async function updateActiveSurface(sourcePath: string): Promise<{ manifest: SurfaceManifest; primaryArtifact: string }> {
  const active = getActiveSurface();
  const rendered = await renderSurface({
    sourcePath,
    title: active.manifest.title,
    surfaceId: active.manifest.surfaceId
  });
  promoteToActive(rendered.stagingDir);
  return {
    manifest: rendered.manifest,
    primaryArtifact: path.join(paths.activeDir, rendered.manifest.entryPath)
  };
}

export function promoteToActive(stagingDir: string): string {
  const tempOld = `${paths.activeDir}.old`;
  fs.rmSync(tempOld, { recursive: true, force: true });
  if (fs.existsSync(paths.activeDir)) {
    fs.renameSync(paths.activeDir, tempOld);
  }
  fs.renameSync(stagingDir, paths.activeDir);
  fs.rmSync(tempOld, { recursive: true, force: true });
  return path.join(paths.activeDir, 'manifest.json');
}
