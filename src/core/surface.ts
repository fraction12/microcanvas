import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
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

const unsupportedPathSchemes = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

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

function ensurePathHasNoSymlinkSegments(resolvedPath: string, rootPath: string, options: { allowRootSymlink?: boolean } = {}): void {
  const relative = path.relative(rootPath, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return;
  }

  const segments = relative.split(path.sep).filter(Boolean);
  let current = rootPath;

  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) {
      if (options.allowRootSymlink && current === path.join(rootPath, segments[0])) {
        continue;
      }
      throw new Error(`Symlink paths are not allowed: ${resolvedPath}`);
    }
  }
}

function ensureSafeResolvedPath(inputPath: string): string {
  if (!inputPath.trim()) {
    throw new Error('Source path must not be empty');
  }

  if (unsupportedPathSchemes.test(inputPath)) {
    throw new Error(`Unsupported source path scheme: ${inputPath}`);
  }

  const resolved = path.resolve(inputPath);
  const repoRootResolved = fs.realpathSync(paths.repoRoot);
  const insideRepo = resolved === repoRootResolved || resolved.startsWith(`${repoRootResolved}${path.sep}`);
  const inspectPath = insideRepo ? resolved : inputPath;
  const checkRoot = insideRepo ? repoRootResolved : path.parse(path.resolve(inspectPath)).root;

  ensurePathHasNoSymlinkSegments(path.resolve(inspectPath), checkRoot, { allowRootSymlink: !insideRepo });

  let real: string;
  try {
    real = fs.realpathSync(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to resolve source path';
    throw new Error(message);
  }

  const stats = fs.statSync(real);
  if (!stats.isFile()) {
    throw new Error(`Source path must be a file: ${inputPath}`);
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
  const content = `${empty}<div class="table-scroll"><table class="data-table">${tableHeader}${tableBody}</table></div>`;

  return buildHtmlDocument(
    title,
    wrapSurfaceContent(content, { surfaceKind: 'table' })
  );
}

function wrapSurfaceContent(content: string, options: { surfaceKind: 'generated' | 'table' }): string {
  const shellClass = options.surfaceKind === 'table'
    ? 'surface-shell surface-shell--table'
    : 'surface-shell';
  return `<main class="${shellClass}">
  <article class="surface-card${options.surfaceKind === 'table' ? ' surface-card--table' : ''}">
    ${content}
  </article>
</main>`;
}

function sanitizeSurfaceHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
      'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4',
      'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'main', 'mark', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
      'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
      'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['scope', 'colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      col: ['span', 'width'],
      colgroup: ['span'],
      '*': []
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    parseStyleAttributes: false
  });
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
        color-scheme: light;
        color: #17212b;
      }
      html {
        background:
          radial-gradient(circle at top left, rgba(108, 122, 137, 0.12), transparent 30%),
          radial-gradient(circle at top right, rgba(108, 122, 137, 0.08), transparent 24%),
          linear-gradient(180deg, rgba(127, 127, 127, 0.04), transparent 35%);
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        line-height: 1.6;
        min-height: 100vh;
        color: #17212b;
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .surface-shell {
        max-width: 980px;
        margin: 32px auto;
        padding: 0 20px 56px;
      }
      .surface-card {
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 20px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
        padding: 28px 32px 32px;
        backdrop-filter: blur(8px);
        color: #17212b;
      }
      .surface-card > :first-child {
        margin-top: 0;
      }
      .surface-card > :last-child {
        margin-bottom: 0;
      }
      .surface-shell--table {
        max-width: 1120px;
      }
      .surface-card--table {
        padding: 24px;
      }
      pre {
        padding: 16px;
        border-radius: 10px;
        overflow-x: auto;
        background: rgba(127, 127, 127, 0.12);
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 0;
      }
      th, td {
        padding: 12px 14px;
        border-right: 1px solid rgba(127, 127, 127, 0.24);
        border-bottom: 1px solid rgba(127, 127, 127, 0.24);
        text-align: left;
        vertical-align: top;
        background: rgba(255, 255, 255, 0.75);
        color: #17212b;
      }
      th {
        background: rgba(127, 127, 127, 0.1);
        font-weight: 600;
      }
      thead th:first-child {
        border-top-left-radius: 14px;
      }
      thead th:last-child {
        border-top-right-radius: 14px;
        border-right: 0;
      }
      tbody tr:last-child td:first-child {
        border-bottom-left-radius: 14px;
      }
      tbody tr:last-child td:last-child {
        border-bottom-right-radius: 14px;
        border-right: 0;
      }
      tr > :last-child {
        border-right: 0;
      }
      .table-scroll {
        overflow-x: auto;
        margin: 18px 0 0;
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.62);
      }
      .table-scroll > table {
        min-width: 100%;
        width: max-content;
      }
      .table-scroll th,
      .table-scroll td {
        white-space: nowrap;
      }
      .table-empty {
        font-style: italic;
        opacity: 0.8;
        margin: 0 0 12px;
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
    const html = buildHtmlDocument(title, wrapSurfaceContent(sanitizeSurfaceHtml(rendered), { surfaceKind: 'generated' }));
    fs.writeFileSync(targetPath, html);
    return;
  }

  if (detected.transform === 'csv-to-html-table') {
    const raw = fs.readFileSync(resolvedSource, 'utf8');
    const html = renderCsvTable(title, raw);
    fs.writeFileSync(targetPath, html);
    return;
  }

  if (detected.contentType === 'text/html' && detected.sourceKind === 'html') {
    const rawHtml = fs.readFileSync(resolvedSource, 'utf8');
    const sanitized = buildHtmlDocument(title, wrapSurfaceContent(sanitizeSurfaceHtml(rawHtml), { surfaceKind: 'generated' }));
    fs.writeFileSync(targetPath, sanitized);
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
  const sourceDir = path.join(stageDir, 'source');
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const detected = detectContentType(resolvedSource);
  const stagedSourceName = path.basename(resolvedSource);
  const stagedSourceRelativePath = path.join('source', stagedSourceName);
  const stagedSourcePath = path.join(stageDir, stagedSourceRelativePath);
  fs.copyFileSync(resolvedSource, stagedSourcePath);

  const targetPath = path.join(stageDir, detected.targetName);
  await materializeArtifact(stagedSourcePath, targetPath, detected, title);

  const manifest = createManifest({
    surfaceId,
    title,
    contentType: detected.contentType,
    entryPath: detected.targetName,
    sourceKind: detected.sourceKind,
    renderMode: detected.renderMode,
    source: {
      originalPath: resolvedSource,
      sourceFileName: stagedSourceName,
      stagedPath: stagedSourcePath,
      stagedRelativePath: stagedSourceRelativePath,
      ingestedAt: new Date().toISOString(),
      externalToRepo: !(resolvedSource === paths.repoRoot || resolvedSource.startsWith(`${paths.repoRoot}${path.sep}`))
    }
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
