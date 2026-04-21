## Why

The viewer now feels more polished, but it still has a trust gap in one important place: the app can lose the last useful visual too eagerly. If the runtime clears, a refresh fails, or the producer moves too quickly, the user can end up seeing less than the last thing that was already working.

The current native snapshot fix also depends on a CoreGraphics whole-window capture API that is deprecated on macOS 14. That path was a valid stopgap, but it should not be the long-term capture strategy.

This follow-up should make the viewer behave like a persistent holding frame and replace the deprecated capture path with supported, surface-aware snapshotting.

## What changes

This change focuses on two tightly related improvements:

1. Persist the last successfully presented surface and keep showing it until a newer surface is actually ready.
2. Replace deprecated whole-window snapshot capture with supported surface-aware capture for the currently presented content.

The viewer should now treat "no newer content is ready" as a hold state rather than a blanking event. That rule should hold during reloads, transient runtime emptiness, failed updates, and viewer relaunch.

## Non-goals

- No new workspace or history browser UI.
- No general gallery of prior surfaces.
- No attempt to preserve every intermediate surface revision.
- No broad runtime-model redesign outside viewer presentation and snapshot behavior.
- No screenshot-only fallback that replaces live surface presentation as the primary model.

## Success criteria

- The viewer keeps the last good visual on screen until a newer surface is successfully promoted.
- Relaunching the native viewer restores the last good surface when its artifact still exists.
- Snapshot capture no longer depends on deprecated whole-window CoreGraphics capture.
- `WKWebView`, image, and PDF snapshots are captured from the presented surface path rather than from the whole app window.
- Degraded snapshot results remain honest when the system is holding previously presented content instead of newer ready content.
