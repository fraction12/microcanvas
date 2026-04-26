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

type SurfaceTransform = 'markdown-to-html' | 'csv-to-html-table' | 'mermaid-to-html';

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
    targetName: 'presented/{basename}'
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
    extensions: ['.mmd', '.mermaid'],
    contentType: 'text/html',
    sourceKind: 'generated',
    renderMode: 'wkwebview',
    targetName: 'index.html',
    transform: 'mermaid-to-html'
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
  return adapter.targetName.replace('{basename}', path.basename(sourcePath));
}


function copyDirectoryRecursive(sourceDir: string, destinationDir: string): void {
  const stats = fs.lstatSync(sourceDir);
  if (!stats.isDirectory()) {
    throw new Error(`Expected directory during ingest: ${sourceDir}`);
  }

  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    const entryStats = fs.lstatSync(sourcePath);

    if (entryStats.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
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
        --surface-ink: #17212b;
        --surface-muted: #52606d;
        --surface-line: rgba(31, 41, 55, 0.14);
        --surface-soft-line: rgba(31, 41, 55, 0.08);
        --surface-paper: rgba(255, 252, 246, 0.88);
        --surface-paper-strong: rgba(255, 255, 255, 0.94);
        --surface-tint: rgba(234, 179, 8, 0.12);
        --surface-shadow: 0 24px 60px rgba(15, 23, 42, 0.10);
      }
      html {
        background:
          radial-gradient(circle at top left, rgba(15, 23, 42, 0.08), transparent 28%),
          radial-gradient(circle at top right, rgba(217, 119, 6, 0.10), transparent 26%),
          linear-gradient(180deg, #f6f1e7 0%, #f8f6f0 42%, #eef3f7 100%);
      }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--surface-ink);
        line-height: 1.6;
        font-family: "SF Pro Text", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        letter-spacing: -0.02em;
      }
      p, li {
        color: var(--surface-ink);
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      }
      .surface-shell {
        position: relative;
        max-width: 980px;
        margin: 40px auto;
        padding: 0 24px 64px;
      }
      .surface-card {
        position: relative;
        overflow: hidden;
        background: linear-gradient(180deg, var(--surface-paper-strong) 0%, var(--surface-paper) 100%);
        border: 1px solid var(--surface-line);
        border-radius: 26px;
        box-shadow: var(--surface-shadow);
        padding: 30px 34px 34px;
        color: var(--surface-ink);
        backdrop-filter: blur(10px);
      }
      .surface-card::before {
        content: '';
        position: absolute;
        inset: 0 0 auto;
        height: 4px;
        background: linear-gradient(90deg, #d97706 0%, #f59e0b 38%, #0f3b53 100%);
        opacity: 0.9;
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
        padding: 16px 18px;
        border-radius: 14px;
        overflow-x: auto;
        background: rgba(15, 23, 42, 0.055);
        border: 1px solid var(--surface-soft-line);
      }
      a {
        color: #0f4c81;
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
        background: rgba(15, 23, 42, 0.06);
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
        border: 1px solid var(--surface-line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.7);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
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
        color: var(--surface-muted);
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


function mermaidRuntimeAssetPath(): string {
  return path.join(paths.repoRoot, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
}

function ensureMermaidRuntimeAsset(destinationDir: string): void {
  const runtimeAssetPath = mermaidRuntimeAssetPath();
  if (!fs.existsSync(runtimeAssetPath)) {
    throw new Error('Mermaid runtime asset is unavailable. Run npm install to restore dependencies.');
  }

  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(runtimeAssetPath, path.join(destinationDir, 'mermaid.min.js'));
}

function buildMermaidDocument(title: string, source: string): string {
  const escapedSource = escapeHtml(source);
  return buildHtmlDocument(
    title,
    `<main class="surface-shell surface-shell--diagram">
  <article class="surface-card surface-card--diagram">
    <header class="diagram-header">
      <div class="diagram-meta-row">
        <p class="diagram-kicker">Mermaid diagram</p>
        <p class="diagram-meta">Viewer-rendered locally · Inspectable output</p>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p class="diagram-dek">A clean presentation layer for agent-generated structure — readable at a glance, with the source still one click away.</p>
    </header>
    <section class="diagram-frame">
      <div class="diagram-frame__label">Rendered canvas</div>
      <div class="diagram-render-output" aria-label="Rendered Mermaid diagram">
        <div class="diagram-toolbar" aria-label="Diagram navigation controls">
          <button type="button" data-diagram-action="zoom-out" aria-label="Zoom out">−</button>
          <button type="button" data-diagram-action="zoom-in" aria-label="Zoom in">+</button>
          <button type="button" data-diagram-action="fit">Fit</button>
          <button type="button" data-diagram-action="actual-size">100%</button>
        </div>
        <div class="diagram-viewport">
          <div class="diagram-stage"></div>
        </div>
      </div>
      <p class="diagram-error" hidden></p>
    </section>
    <details class="diagram-source">
      <summary>
        <span>Diagram source</span>
        <span class="diagram-source-hint">Reveal the underlying Mermaid</span>
      </summary>
      <pre><code>${escapedSource}</code></pre>
    </details>
  </article>
</main>`
  ).replace(
    '</body>',
    `    <script src="./assets/mermaid.min.js"></script>
    <script>
      const MICROCANVAS_MERMAID_SOURCE = ${JSON.stringify(source)};
      window.__microcanvasSurfaceReady = false;
      document.documentElement.dataset.microcanvasRenderState = 'pending';

      (async () => {
        const output = document.querySelector('.diagram-render-output');
        const viewport = document.querySelector('.diagram-viewport');
        const stage = document.querySelector('.diagram-stage');
        const error = document.querySelector('.diagram-error');
        const mermaidApi = window.mermaid || window.__esbuild_esm_mermaid_nm?.mermaid;

        if (!output || !viewport || !stage || !error || !mermaidApi) {
          if (error) {
            error.hidden = false;
            error.textContent = 'Mermaid runtime failed to load.';
          }
          document.documentElement.dataset.microcanvasRenderState = 'error';
          window.__microcanvasSurfaceReady = true;
          return;
        }

        const readableMinimumScale = 0.72;
        const minimumScale = 0.12;
        const maximumScale = 4;
        const zoomStep = 1.2;
        const transform = { x: 0, y: 0, scale: 1 };
        const diagramSize = { width: 1, height: 1 };
        let drag = null;
        let userNavigated = false;

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

        const applyTransform = () => {
          stage.style.transform = \`translate(\${transform.x}px, \${transform.y}px) scale(\${transform.scale})\`;
          stage.dataset.scale = transform.scale.toFixed(3);
        };

        const getViewportSize = () => ({
          width: Math.max(1, viewport.clientWidth),
          height: Math.max(1, viewport.clientHeight)
        });

        const getSvgSize = (svg) => {
          const viewBox = svg.viewBox?.baseVal;
          if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
            return { width: viewBox.width, height: viewBox.height };
          }

          const widthAttribute = Number.parseFloat(svg.getAttribute('width') || '');
          const heightAttribute = Number.parseFloat(svg.getAttribute('height') || '');
          if (Number.isFinite(widthAttribute) && Number.isFinite(heightAttribute) && widthAttribute > 0 && heightAttribute > 0) {
            return { width: widthAttribute, height: heightAttribute };
          }

          try {
            const box = svg.getBBox();
            if (box.width > 0 && box.height > 0) {
              return { width: box.width, height: box.height };
            }
          } catch {
            // Some SVG content cannot be measured with getBBox until fully painted.
          }

          const rect = svg.getBoundingClientRect();
          return {
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height)
          };
        };

        const getFitScale = () => {
          const viewportSize = getViewportSize();
          const padding = 32;
          const availableWidth = Math.max(1, viewportSize.width - padding);
          const availableHeight = Math.max(1, viewportSize.height - padding);
          return clamp(
            Math.min(availableWidth / diagramSize.width, availableHeight / diagramSize.height),
            minimumScale,
            maximumScale
          );
        };

        const centerAtScale = (scale) => {
          const viewportSize = getViewportSize();
          transform.scale = clamp(scale, minimumScale, maximumScale);
          transform.x = (viewportSize.width - diagramSize.width * transform.scale) / 2;
          transform.y = (viewportSize.height - diagramSize.height * transform.scale) / 2;
          applyTransform();
        };

        const zoomAtCenter = (nextScale) => {
          const viewportSize = getViewportSize();
          const clampedScale = clamp(nextScale, minimumScale, maximumScale);
          const centerX = viewportSize.width / 2;
          const centerY = viewportSize.height / 2;
          const ratio = clampedScale / transform.scale;
          transform.x = centerX - (centerX - transform.x) * ratio;
          transform.y = centerY - (centerY - transform.y) * ratio;
          transform.scale = clampedScale;
          userNavigated = true;
          applyTransform();
        };

        const initializeTransform = () => {
          const fitScale = getFitScale();
          centerAtScale(fitScale >= readableMinimumScale ? fitScale : readableMinimumScale);
        };

        output.querySelectorAll('[data-diagram-action]').forEach((button) => {
          button.addEventListener('click', () => {
            const action = button.getAttribute('data-diagram-action');
            userNavigated = true;
            if (action === 'zoom-in') {
              zoomAtCenter(transform.scale * zoomStep);
            } else if (action === 'zoom-out') {
              zoomAtCenter(transform.scale / zoomStep);
            } else if (action === 'fit') {
              centerAtScale(getFitScale());
            } else if (action === 'actual-size') {
              centerAtScale(1);
            }
          });
        });

        viewport.addEventListener('pointerdown', (event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
          }
          drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: transform.x,
            originY: transform.y
          };
          viewport.setPointerCapture(event.pointerId);
          viewport.classList.add('is-panning');
          userNavigated = true;
        });

        viewport.addEventListener('pointermove', (event) => {
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }
          transform.x = drag.originX + event.clientX - drag.startX;
          transform.y = drag.originY + event.clientY - drag.startY;
          applyTransform();
        });

        const endDrag = (event) => {
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }
          drag = null;
          viewport.classList.remove('is-panning');
        };

        viewport.addEventListener('pointerup', endDrag);
        viewport.addEventListener('pointercancel', endDrag);
        viewport.addEventListener('wheel', (event) => {
          event.preventDefault();
          transform.x -= event.deltaX;
          transform.y -= event.deltaY;
          userNavigated = true;
          applyTransform();
        }, { passive: false });

        mermaidApi.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
            primaryColor: '#fff8eb',
            primaryTextColor: '#17212b',
            primaryBorderColor: '#d7c3a3',
            lineColor: '#31556d',
            secondaryColor: '#f5eee3',
            tertiaryColor: '#eef3f7',
            clusterBkg: '#fff9ef',
            clusterBorder: '#d9c3a0',
            edgeLabelBackground: '#fffaf0',
            actorBkg: '#f3ead8',
            actorBorder: '#c8ae80',
            signalColor: '#31556d',
            noteBkgColor: '#fff6dd',
            noteBorderColor: '#d9be88'
          },
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          }
        });

        try {
          const renderResult = await mermaidApi.render('microcanvas-mermaid-diagram', MICROCANVAS_MERMAID_SOURCE);
          stage.innerHTML = renderResult.svg;
          if (typeof renderResult.bindFunctions === 'function') {
            renderResult.bindFunctions(stage);
          }
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const renderedSvg = stage.querySelector('svg');
          if (!renderedSvg) {
            throw new Error('Mermaid did not produce an SVG output.');
          }
          const measuredSize = getSvgSize(renderedSvg);
          diagramSize.width = measuredSize.width;
          diagramSize.height = measuredSize.height;
          renderedSvg.style.maxWidth = 'none';
          renderedSvg.style.width = \`\${diagramSize.width}px\`;
          renderedSvg.style.height = \`\${diagramSize.height}px\`;
          stage.style.width = \`\${diagramSize.width}px\`;
          stage.style.height = \`\${diagramSize.height}px\`;
          initializeTransform();

          if ('ResizeObserver' in window) {
            const resizeObserver = new ResizeObserver(() => {
              if (!userNavigated) {
                initializeTransform();
              }
            });
            resizeObserver.observe(viewport);
          }

          document.documentElement.dataset.microcanvasRenderState = 'ready';
          window.__microcanvasSurfaceReady = true;
        } catch (cause) {
          output.setAttribute('hidden', 'hidden');
          error.hidden = false;
          error.textContent = cause && typeof cause === 'object' && 'message' in cause
            ? String(cause.message)
            : String(cause);
          document.documentElement.dataset.microcanvasRenderState = 'error';
          window.__microcanvasSurfaceReady = true;
        }
      })();
    </script>
  </body>`
  ).replace(
    '</style>',
    `
      .surface-shell--diagram {
        max-width: 1280px;
      }
      .surface-card--diagram {
        padding: 28px 28px 32px;
      }
      .diagram-header {
        padding-bottom: 18px;
        border-bottom: 1px solid var(--surface-soft-line);
      }
      .diagram-meta-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .diagram-header h1 {
        margin: 10px 0 0;
        font-size: clamp(1.5rem, 2vw, 2.15rem);
        line-height: 1.08;
      }
      .diagram-kicker {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        font-weight: 700;
        color: #9a6700;
      }
      .diagram-meta {
        margin: 0;
        font-size: 0.82rem;
        color: var(--surface-muted);
      }
      .diagram-dek {
        margin: 12px 0 0;
        max-width: 62ch;
        color: var(--surface-muted);
        font-size: 0.98rem;
      }
      .diagram-frame {
        overflow: hidden;
        margin-top: 22px;
        padding: 22px;
        border-radius: 22px;
        background:
          linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(247, 243, 235, 0.96));
        border: 1px solid rgba(143, 116, 74, 0.18);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.9),
          0 10px 24px rgba(15, 23, 42, 0.05);
      }
      .diagram-frame__label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 59, 83, 0.08);
        border: 1px solid rgba(15, 59, 83, 0.1);
        color: #0f3b53;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .diagram-render-output {
        display: grid;
        gap: 12px;
        min-height: 420px;
      }
      .diagram-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }
      .diagram-toolbar button {
        appearance: none;
        min-width: 40px;
        height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(15, 59, 83, 0.18);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.82);
        color: #0f3b53;
        font: inherit;
        font-size: 0.84rem;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      }
      .diagram-toolbar button:hover {
        background: #ffffff;
        border-color: rgba(15, 59, 83, 0.34);
      }
      .diagram-toolbar button:focus-visible {
        outline: 3px solid rgba(15, 76, 129, 0.24);
        outline-offset: 2px;
      }
      .diagram-viewport {
        position: relative;
        height: clamp(420px, 64vh, 760px);
        min-height: 360px;
        overflow: hidden;
        border: 1px solid rgba(15, 59, 83, 0.12);
        border-radius: 16px;
        background:
          linear-gradient(rgba(15, 59, 83, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 59, 83, 0.04) 1px, transparent 1px),
          rgba(255, 255, 255, 0.58);
        background-size: 28px 28px;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .diagram-viewport.is-panning {
        cursor: grabbing;
      }
      .diagram-stage {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        will-change: transform;
      }
      .diagram-frame svg {
        display: block;
        height: auto;
        max-width: none;
      }
      .diagram-error {
        margin: 0;
        color: #991b1b;
        font-weight: 600;
      }
      .diagram-source {
        margin-top: 18px;
        border: 1px solid var(--surface-soft-line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.56);
      }
      .diagram-source summary {
        cursor: pointer;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        list-style: none;
        font-weight: 600;
      }
      .diagram-source summary::-webkit-details-marker {
        display: none;
      }
      .diagram-source-hint {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--surface-muted);
      }
      .diagram-source pre {
        margin: 0;
        border: 0;
        border-top: 1px solid var(--surface-soft-line);
        border-radius: 0 0 18px 18px;
        background: rgba(15, 23, 42, 0.045);
      }
    </style>`
  );
}

async function materializeArtifact(
  resolvedSource: string,
  targetPath: string,
  detected: Detection,
  title: string,
  options: { originalSourcePath?: string } = {}
): Promise<void> {
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

  if (detected.transform === 'mermaid-to-html') {
    const raw = fs.readFileSync(resolvedSource, 'utf8');
    ensureMermaidRuntimeAsset(path.join(path.dirname(targetPath), 'assets'));
    const html = buildMermaidDocument(title, raw);
    fs.writeFileSync(targetPath, html);
    return;
  }

  if (detected.contentType === 'text/html' && detected.sourceKind === 'html') {
    const originalSourcePath = options.originalSourcePath ?? resolvedSource;
    const originalSourceDirectory = path.dirname(originalSourcePath);
    const presentedDirectory = path.dirname(targetPath);
    fs.rmSync(presentedDirectory, { recursive: true, force: true });
    copyDirectoryRecursive(originalSourceDirectory, presentedDirectory);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Rendered html surface is missing after ingest: ${targetPath}`);
    }

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
  await materializeArtifact(stagedSourcePath, targetPath, detected, title, { originalSourcePath: resolvedSource });

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
