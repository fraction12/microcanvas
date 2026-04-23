# CLI Pretty Pass Design

## Summary

Microcanvas should get a lightweight CLI presentation upgrade that makes human-mode output feel polished, memorable, and on-brand without changing command behavior or the JSON contract.

This is intentionally a small pass, not a CLI architecture project. The goal is to make the existing commands look and read better in normal terminal use with the least amount of implementation effort.

## Goals

- Make all human-readable command output feel prettier and more intentional.
- Improve the emotional quality of success, warning, and failure output.
- Give the CLI a little demo energy without turning it into a chat bot.
- Keep `--json` output unchanged and fully reliable for agents and scripts.
- Make the palette and styling feel consistent with the README banner.

## Non-Goals

- No event bus or command lifecycle refactor.
- No large progress architecture.
- No deep rework of command handlers or runtime behavior.
- No change to JSON payload shape, semantics, or verification rules.
- No elaborate animation system or terminal-only feature that breaks snapshots, tests, or pipes.

## Product Direction

The CLI should feel like a small stage-ready tool instead of a raw protocol shell.

The target tone is:

- showpiece/demo-friendly
- playful but trustworthy
- visually distinct without being noisy
- quick to scan during real use

The CLI should not sound like a conversational assistant. It should still feel like a CLI, just one with better taste.

## Output Modes

Microcanvas should support two practical output modes:

1. Structured mode
   - Triggered by `--json`
   - Existing JSON behavior remains unchanged
   - No presentation styling should leak into this mode

2. Human mode
   - Used for normal terminal output
   - When attached to an interactive TTY, use the pretty presentation layer
   - When not attached to a TTY, fall back to plain, readable text without relying on color or layout tricks

This preserves compatibility while making the common interactive path feel much better.

## Visual Theme

The CLI theme should derive from the README banner at `docs/assets/readme-banner.png`.

The banner’s core visual language is:

- sea-glass teal and aqua
- coral/lobster red
- warm cream and sand
- deep ink outlines
- gold used as a small highlight, not a dominant system color

The CLI should translate that banner into terminal-friendly tokens:

- primary brand accent: teal
- strong emphasis accent: coral
- neutral foreground: cream or bright neutral text
- low-emphasis text: muted slate/gray
- success, warning, and error colors: semantic first, but tuned to sit comfortably inside the same warm illustrated world

The result should feel “Microcanvas” rather than generic blue developer tooling.

## Presentation Rules

### Help Output

Help should feel like a product surface rather than a raw command dump.

Changes:

- stronger title and short subtitle
- clearer command list formatting
- better spacing between commands
- examples that read like guided starting points
- slightly stronger personality in descriptions, but still concise

The help page should answer three questions quickly:

1. What is Microcanvas?
2. What are the main commands?
3. What should I try first?

### Success Output

Success output should lead with a clean, visually distinct headline and then show a compact set of useful details.

Typical pattern:

- short success line
- 2-5 detail rows
- optional artifact or viewer context
- optional next step when helpful

Examples of detail rows:

- surface id
- viewer mode
- verification status
- primary artifact path
- snapshot path

### Warning Output

Warnings should not look like accidental leftover text. They should read as intentional callouts.

Use cases include:

- degraded viewer mode
- partially verified states
- held-last-good snapshot messaging

Warnings should be visually separated from success output while still feeling part of the same result block.

### Failure Output

Failure output should feel clearer and calmer.

It should visually separate:

- the primary failure
- the reason
- the likely next move

The goal is to reduce “what do I do now?” moments without making errors verbose.

### Status-Like Output

`status` and `verify` should be especially easy to scan in demos.

Use compact grouped sections or key-value rows so the user can immediately spot:

- active surface
- viewer state
- verification availability
- lock state
- artifact path

This should still stay simple enough to read in a narrow terminal.

## Interaction Style

We are deliberately keeping live behavior shallow.

Allowed:

- small spinner or lightweight transient progress indicator if a library makes it trivial
- stronger final state formatting
- subtle separation between phases of output

Not allowed:

- multi-stage animated flows
- persistent status dashboards
- complex redraw logic
- behavior that makes logs, tests, or copy-paste outputs messy

If a live effect adds fragility, skip it.

## Implementation Shape

Keep the implementation small and centralized.

Recommended structure:

- one shared presentation helper for human-mode output
- one small theme/token definition
- one place for reusable rendering patterns such as:
  - headline rows
  - key-value detail rows
  - warning blocks
  - error blocks
  - help formatting

Existing command handlers should keep returning the same core result data. The pretty layer should sit on top of that rather than forcing command-specific formatting logic into every handler.

## Dependency Strategy

Use a small set of proven CLI dependencies if they materially reduce effort.

Good candidates:

- color/styling helper
- terminal capability detection
- optional small spinner utility

Avoid introducing a large presentation stack. The implementation should stay easy to reason about and easy to remove or simplify later.

## Testing Strategy

Testing should stay pragmatic.

Required:

- preserve existing JSON behavior
- add targeted tests for shared formatting helpers where behavior matters
- verify TTY-aware fallback behavior at the helper level when practical

Avoid:

- large golden-output snapshot suites for every command
- brittle tests tied to exact ANSI sequences everywhere

This is a polish pass, so testing should focus on stability boundaries, not on pixel-perfect terminal theater.

## Rollout Plan

Apply the pretty pass across all current commands:

- `render`
- `show`
- `update`
- `snapshot`
- `verify`
- `status`

The rollout order should be:

1. shared presentation primitives and theme
2. help output
3. success/warning/failure rendering across all commands
4. scan-friendly status and verify summaries
5. lightweight polish pass after real terminal use

## Success Criteria

This design is successful if:

- human-mode output feels visibly more polished immediately
- the CLI feels aligned with the README banner personality
- demos look better without extra explanation
- JSON consumers see no contract change
- the implementation remains small, understandable, and fast to land

