import {
  fail,
  invalidInput,
  lockedOrBusy,
  ok,
  operationalFailure as agentOperationalFailure,
  type CommandFailure,
  type CommandResult,
  type CommandSuccess
} from 'agenttk';
import type { ViewerLaunchDiagnostics } from '../core/manifest.js';

export type MicrocanvasResultType =
  | 'render'
  | 'show'
  | 'update'
  | 'snapshot'
  | 'verify'
  | 'status';

export interface MicrocanvasRecord {
  message: string;
  surfaceId?: string;
  viewer?: {
    mode: string;
    open: boolean;
    canVerify: boolean;
    launch?: ViewerLaunchDiagnostics;
    launchDiagnostics?: ViewerLaunchDiagnostics;
  };
  lock?: {
    held: boolean;
    reason?: string;
  };
  artifacts?: {
    primary?: string;
    snapshot?: string;
    stagedSource?: string;
  };
  source?: {
    originalPath: string;
    stagedPath: string;
    externalToRepo: boolean;
  };
}

type SuccessOptions = Omit<CommandSuccess<MicrocanvasRecord>, 'ok' | 'type' | 'record'> & {
  type: MicrocanvasResultType;
  record: MicrocanvasRecord;
};

export function successResult(options: SuccessOptions): CommandSuccess<MicrocanvasRecord> {
  return ok({
    destination: 'runtime',
    ...options
  });
}

export function lockFailure(type: MicrocanvasResultType, reason?: string): CommandFailure {
  return lockedOrBusy(reason ?? 'runtime is locked', {
    type,
    code: 'LOCKED_TRY_LATER'
  });
}

export function inputFailure(type: MicrocanvasResultType, code: string, message: string): CommandFailure {
  return invalidInput(message, {
    type,
    code
  });
}

export function operationalFailure(
  type: MicrocanvasResultType,
  code: string,
  message: string,
  options: Omit<CommandFailure, 'ok' | 'type' | 'error'> = {}
): CommandFailure {
  const result = agentOperationalFailure(message, {
    type,
    code,
    classification: options.classification,
    retryable: options.retryable,
    nextAction: options.nextAction
  });

  return {
    ...result,
    ...options
  };
}

export function viewerLaunchFailure(
  type: MicrocanvasResultType,
  message: string,
  launch: ViewerLaunchDiagnostics | undefined
): CommandFailure {
  return fail({
    type,
    classification: 'transient',
    retryable: true,
    nextAction: 'verify_state',
    verificationStatus: 'verification_failed',
    partial: true,
    error: {
      code: 'VIEWER_LAUNCH_FAILED',
      message,
      details: {
        launch
      }
    }
  });
}

export function parsePrefixedError(error: unknown): { code?: string; message: string } {
  const message = error instanceof Error ? error.message : 'operation failed';
  const match = /^(INVALID_INPUT|UNSUPPORTED_CONTENT):\s*(.*)$/.exec(message);
  if (match) {
    return {
      code: match[1],
      message: match[2]
    };
  }

  return {
    message
  };
}

export function isFailure(result: CommandResult<MicrocanvasRecord>): result is CommandFailure {
  return result.ok === false;
}
