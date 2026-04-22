import test from 'node:test';
import assert from 'node:assert/strict';

import { paletteTokens, renderCommandResult, renderToolHelp, resolvePresentationMode } from '../dist/cli/presentation.js';

test('resolvePresentationMode prefers pretty only for interactive color-capable terminals', () => {
  assert.equal(resolvePresentationMode({ isTTY: true }, { NO_COLOR: '' }), 'plain');
  assert.equal(resolvePresentationMode({ isTTY: false }, { NO_COLOR: '' }), 'plain');
  assert.equal(resolvePresentationMode({ isTTY: true }, { NO_COLOR: '1' }), 'plain');
  assert.equal(resolvePresentationMode({ isTTY: true }, {}), 'pretty');
});

test('renderCommandResult formats snapshot success details for operators', () => {
  const output = renderCommandResult(
    {
      ok: true,
      type: 'snapshot',
      id: 'surface-123',
      verificationStatus: 'unverified',
      verified: false,
      warnings: ['Viewer held last good content while capture completed.'],
      record: {
        message: 'Held last good snapshot because live capture is degraded.',
        surfaceId: 'surface-123',
        viewer: {
          mode: 'native',
          open: true,
          canVerify: true
        },
        lock: {
          held: false,
          reason: 'held-last-good'
        },
        artifacts: {
          primary: '/tmp/runtime/active/index.html',
          snapshot: '/tmp/runtime/snapshots/surface-123.png'
        }
      }
    },
    'plain'
  );

  assert.match(output, /OK Snapshot/);
  assert.match(output, /surface-123/);
  assert.match(output, /viewer:\s+native/i);
  assert.match(output, /Held last good snapshot/i);
  assert.match(output, /Lock reason: held-last-good/);
  assert.match(output, /Warning:/i);
  assert.doesNotMatch(output, /Lock reason: held last good/);
});

test('renderCommandResult humanizes shared status metadata without rewriting ids or paths', () => {
  const output = renderCommandResult(
    {
      ok: true,
      type: 'status',
      id: 'surface-human',
      verificationStatus: 'not_applicable',
      record: {
        message: 'runtime state loaded',
        surfaceId: 'surface-human',
        viewer: {
          mode: 'degraded',
          open: true,
          canVerify: false
        },
        lock: {
          held: false
        },
        artifacts: {
          primary: '/tmp/runtime/active/index.html'
        }
      }
    },
    'plain'
  );

  assert.match(output, /OK Status/);
  assert.match(output, /Surface: surface-human/);
  assert.match(output, /Primary: \/tmp\/runtime\/active\/index\.html/);
  assert.match(output, /Verification: not applicable/);
  assert.doesNotMatch(output, /Verification: not_applicable/);
});

test('renderCommandResult formats verify failures with recovery context', () => {
  const output = renderCommandResult(
    {
      ok: false,
      type: 'verify',
      classification: 'unknown',
      retryable: true,
      nextAction: 'verify_state',
      verificationStatus: 'verification_failed',
      error: {
        code: 'VERIFY_FAILED',
        message: 'viewer is open but not yet reporting the active surface',
        details: {
          reason: 'viewer is open but not yet reporting the active surface'
        }
      }
    },
    'plain'
  );

  assert.match(output, /ERR Verify failed/);
  assert.match(output, /VERIFY_FAILED/);
  assert.match(output, /viewer is open but not yet reporting the active surface/);
  assert.match(output, /Classification: unknown/);
  assert.match(output, /Retryable: yes/);
  assert.match(output, /Next: verify state/);
  assert.match(output, /Verification: verification failed/);
  assert.doesNotMatch(output, /Next: verify_state/);
  assert.doesNotMatch(output, /Verification: verification_failed/);
});

test('renderCommandResult humanizes user action required classification without changing exact codes', () => {
  const output = renderCommandResult(
    {
      ok: false,
      type: 'show',
      classification: 'user_action_required',
      retryable: false,
      nextAction: 'fix_input',
      error: {
        code: 'INVALID_INPUT',
        message: 'Path escapes allowed roots'
      }
    },
    'plain'
  );

  assert.match(output, /ERR Show/);
  assert.match(output, /Code: INVALID_INPUT/);
  assert.match(output, /Reason: Path escapes allowed roots/);
  assert.match(output, /Classification: user action required/);
  assert.match(output, /Next: fix input/);
  assert.doesNotMatch(output, /Classification: user_action_required/);
  assert.doesNotMatch(output, /Next: fix_input/);
});

test('renderToolHelp includes the shared tool overview and first-step guidance', () => {
  const output = renderToolHelp(
    {
      kind: 'tool',
      name: 'microcanvas',
      description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
      commands: [
        { name: 'render', description: 'Render a supported source file into staging.' },
        { name: 'show', description: 'Activate a staged surface or render and show a source file.' },
        { name: 'status', description: 'Report runtime, lock, and viewer state.' }
      ]
    },
    'plain'
  );

  assert.match(output, /microcanvas/);
  assert.match(output, /tiny stagehand for AI tools/i);
  assert.match(output, /Try first:/);
  assert.match(output, /microcanvas show README\.md/);
  assert.match(output, /render/);
  assert.match(output, /status/);
});

test('renderToolHelp derives quick-start examples from the tool metadata', () => {
  const output = renderToolHelp(
    {
      kind: 'tool',
      name: 'stagekit',
      description: 'Tiny stage runtime.',
      commands: [
        { name: 'show', description: 'Show a staged source.' },
        { name: 'verify', description: 'Verify runtime state.' },
        { name: 'status', description: 'Report runtime state.' }
      ]
    },
    'plain'
  );

  assert.match(output, /stagekit show README\.md/);
  assert.match(output, /stagekit verify/);
  assert.match(output, /stagekit status/);
  assert.doesNotMatch(output, /microcanvas show README\.md/);
});

test('renderToolHelp renders command help records with usage and examples', () => {
  const output = renderToolHelp(
    {
      kind: 'command',
      toolName: 'microcanvas',
      name: 'render',
      description: 'Render a supported source file into staging.',
      usage: 'microcanvas render <path> [--json]',
      examples: ['microcanvas render README.md', 'microcanvas render README.md --json']
    },
    'plain'
  );

  assert.match(output, /microcanvas render/);
  assert.match(output, /Usage:\s+microcanvas render <path> \[--json\]/);
  assert.match(output, /Examples:/);
  assert.match(output, /microcanvas render README\.md --json/);
});

test('pretty mode emits ANSI styling across help and command results while plain mode stays unstyled', () => {
  const record = {
    kind: 'tool',
    name: 'microcanvas',
    description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
    commands: [
      { name: 'show', description: 'Activate a staged surface or render and show a source file.' },
      { name: 'render', description: 'Render a supported source file into staging.' },
      { name: 'status', description: 'Report runtime, lock, and viewer state.' }
    ]
  };

  const plainOutput = renderToolHelp(record, 'plain');
  const prettyOutput = renderToolHelp(record, 'pretty');
  const plainResult = renderCommandResult(
    {
      ok: false,
      type: 'verify',
      classification: 'unknown',
      retryable: true,
      nextAction: 'verify_state',
      verificationStatus: 'verification_failed',
      error: {
        code: 'VERIFY_FAILED',
        message: 'viewer is open but not yet reporting the active surface'
      }
    },
    'plain'
  );
  const prettyResult = renderCommandResult(
    {
      ok: false,
      type: 'verify',
      classification: 'unknown',
      retryable: true,
      nextAction: 'verify_state',
      verificationStatus: 'verification_failed',
      error: {
        code: 'VERIFY_FAILED',
        message: 'viewer is open but not yet reporting the active surface'
      }
    },
    'pretty'
  );

  assert.doesNotMatch(plainOutput, /\u001b\[/);
  assert.match(prettyOutput, /\u001b\[/);
  assert.doesNotMatch(plainResult, /\u001b\[/);
  assert.match(prettyResult, /\u001b\[/);
  assert.match(prettyResult, /Next: verify state/);
});

test('pretty mode uses the banner-derived palette tokens for live styling', () => {
  const prettyHelp = renderToolHelp(
    {
      kind: 'tool',
      name: 'microcanvas',
      description: 'A lightweight, agent-friendly canvas runtime and native viewer.',
      commands: [{ name: 'show', description: 'Activate a staged surface or render and show a source file.' }]
    },
    'pretty'
  );

  const [tealRed, tealGreen, tealBlue] = [
    Number.parseInt(paletteTokens.teal.slice(1, 3), 16),
    Number.parseInt(paletteTokens.teal.slice(3, 5), 16),
    Number.parseInt(paletteTokens.teal.slice(5, 7), 16)
  ];
  const [coralRed, coralGreen, coralBlue] = [
    Number.parseInt(paletteTokens.coral.slice(1, 3), 16),
    Number.parseInt(paletteTokens.coral.slice(3, 5), 16),
    Number.parseInt(paletteTokens.coral.slice(5, 7), 16)
  ];

  assert.match(prettyHelp, new RegExp(`\\u001b\\[1m\\u001b\\[38;2;${tealRed};${tealGreen};${tealBlue}m`));
  assert.match(prettyHelp, new RegExp(`\\u001b\\[1m\\u001b\\[38;2;${coralRed};${coralGreen};${coralBlue}m`));
});
