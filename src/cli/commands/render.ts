import type { CommandResult } from 'agenttk';
import { inputFailure, parsePrefixedError, successResult, type MicrocanvasRecord } from '../contracts.js';
import { renderSurface } from '../../core/surface.js';

export async function runRender(sourcePath?: string): Promise<CommandResult<MicrocanvasRecord>> {
  if (!sourcePath) {
    return inputFailure('render', 'INVALID_INPUT', 'render requires a source file path');
  }

  try {
    const rendered = await renderSurface({ sourcePath });
    return successResult({
      type: 'render',
      id: rendered.manifest.surfaceId,
      verificationStatus: 'not_applicable',
      record: {
        message: 'surface rendered to staging',
        surfaceId: rendered.manifest.surfaceId,
        viewer: {
          mode: 'closed',
          open: false,
          canVerify: false
        },
        lock: {
          held: false
        },
        artifacts: {
          primary: rendered.primaryArtifact,
          stagedSource: rendered.manifest.source.stagedPath
        },
        source: {
          originalPath: rendered.manifest.source.originalPath,
          stagedPath: rendered.manifest.source.stagedPath,
          externalToRepo: rendered.manifest.source.externalToRepo
        }
      }
    });
  } catch (error) {
    const parsed = parsePrefixedError(error);
    return inputFailure('render', parsed.code ?? 'INVALID_INPUT', parsed.message);
  }
}
