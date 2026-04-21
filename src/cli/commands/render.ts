import { printResult } from '../../core/results.js';
import { renderSurface } from '../../core/surface.js';

export async function runRender(sourcePath?: string): Promise<void> {
  if (!sourcePath) {
    printResult({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'render requires a source file path',
      surfaceId: null,
      viewer: { open: false },
      lock: { held: false },
      artifacts: {}
    });
    return;
  }

  try {
    const rendered = await renderSurface({ sourcePath });
    printResult({
      ok: true,
      code: 'OK',
      message: 'surface rendered to staging',
      surfaceId: rendered.manifest.surfaceId,
      viewer: { open: false },
      lock: { held: false },
      artifacts: { primary: rendered.primaryArtifact }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'render failed';
    printResult({
      ok: false,
      code: 'INVALID_INPUT',
      message: message.replace(/^INVALID_INPUT:\s*/, ''),
      surfaceId: null,
      viewer: { open: false },
      lock: { held: false },
      artifacts: {}
    });
  }
}
