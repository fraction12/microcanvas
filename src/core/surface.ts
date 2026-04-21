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

type Detection = {
  contentType: string;
  sourceKind: SurfaceManifest['sourceKind'];
  renderMode: string;
  targetName: string;
  transform?: 'markdown-to-html';
};

const allowedRoots = [paths.repoRoot];

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

function detectContentType(sourcePath: string): Detection {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    return { contentType: 'text/html', sourceKind: 'html', renderMode: 'wkwebview', targetName: 'index.html' };
  }
  if (ext === '.md' || ext === '.markdown') {
    return {
      contentType: 'text/html',
      sourceKind: 'generated',
      renderMode: 'wkwebview',
      targetName: 'index.html',
      transform: 'markdown-to-html'
    };
  }
  if (ext === '.pdf') {
    return { contentType: 'application/pdf', sourceKind: 'pdf', renderMode: 'pdf', targetName: path.basename(sourcePath) };
  }
  if (ext === '.txt' || ext === '.json' || ext === '.js' || ext === '.ts') {
    return {
      contentType: 'text/html',
      sourceKind: 'generated',
      renderMode: 'wkwebview',
      targetName: 'index.html',
      transform: 'markdown-to-html'
    };
  }
  return { contentType: 'application/octet-stream', sourceKind: 'artifact', renderMode: 'file', targetName: path.basename(sourcePath) };
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
    throw new Error(`INVALID_INPUT: ${error instanceof Error ? error.message : 'invalid source path'}`);
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
