import { fail, ok, type CommandFailure, type CommandResult, type CommandSuccess } from 'agenttk';
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

type FailureOptions = Omit<CommandFailure, 'ok'> & {
  type?: MicrocanvasResultType;
};

export function successResult(options: SuccessOptions): CommandSuccess<MicrocanvasRecord> {
  return ok({
    destination: 'runtime',
    ...options
  });
}

export function failureResult(options: FailureOptions): CommandFailure {
  return fail(options);
}

export function lockFailure(type: MicrocanvasResultType, reason?: string): CommandFailure {
  return failureResult({
    type,
    classification: 'transient',
    retryable: true,
    nextAction: 'retry',
    error: {
      code: 'LOCKED_TRY_LATER',
      message: reason ?? 'runtime is locked'
    }
  });
}

export function inputFailure(type: MicrocanvasResultType, code: string, message: string): CommandFailure {
  return failureResult({
    type,
    classification: 'user_action_required',
    retryable: false,
    nextAction: 'fix_input',
    error: {
      code,
      message
    }
  });
}

export function operationalFailure(
  type: MicrocanvasResultType,
  code: string,
  message: string,
  options: Omit<FailureOptions, 'type' | 'error'> = {}
): CommandFailure {
  return failureResult({
    type,
    error: {
      code,
      message
    },
    ...options
  });
}

export function viewerLaunchFailure(
  type: MicrocanvasResultType,
  message: string,
  launch: ViewerLaunchDiagnostics | undefined
): CommandFailure {
  return failureResult({
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
