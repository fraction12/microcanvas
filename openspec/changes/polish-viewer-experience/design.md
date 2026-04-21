## Design

Viewer polish should make Microcanvas feel calm, clear, and trustworthy, not more complicated.

### Design principles

1. **Polish the existing product shape**
   - Improve how current surfaces are presented.
   - Do not use polish as an excuse to add workspace sprawl.

2. **Presentation over chrome**
   - Better layout, spacing, loading, and fallback states matter more than adding controls.
   - Keep interface chrome minimal.

3. **Confidence matters**
   - A polished viewer should not only look better, it should behave more reliably around reload and snapshot timing.

### Wedge A: Surface presentation polish

#### Images
- center images cleanly in the viewer
- use a sensible background/canvas treatment
- fit images predictably within the window
- avoid awkward raw-file framing

#### Tables
- improve table spacing and typography
- improve overflow handling for wide tables
- optionally add a sticky header only if it remains lightweight and stable

#### HTML-like generated surfaces
- reduce the feeling that the viewer is simply opening a raw local file with no opinionated presentation
- prefer consistent visual framing where that helps rather than distracts

### Wedge B: Empty, fallback, and error states

The viewer should provide intentional states for situations such as:
- no active surface
- unsupported render mode
- active manifest present but entry missing
- viewer open before content is ready
- snapshot requested before visible content is ready

These states should communicate clearly without becoming verbose.

### Wedge C: Load/reload and snapshot confidence

The viewer should improve its confidence around content readiness.

This includes:
- cleaner reload/update transitions
- better timing awareness for content load completion
- snapshot behavior that avoids capturing half-loaded or visibly incomplete surfaces

#### Initial implementation slice

The first implementation pass for this wedge should stay narrow and prove the readiness model on `WKWebView` surfaces before broadening it to PDF and image rendering paths.

That first slice should:
- add a small viewer-owned readiness model with practical states such as `loading`, `ready`, and `degraded`
- preserve the last ready `WKWebView` presentation while refreshed content loads
- show lightweight updating treatment instead of flashing blank or visibly incomplete content
- make snapshot behavior explicit about whether the returned capture is fresh or degraded

#### Hybrid reload behavior

For `WKWebView` updates, the viewer should keep the last ready frame visible while replacement content loads. The user should see subtle updating feedback, but the viewer should not eagerly swap to an obviously half-loaded page.

This gives the viewer a calmer presentation path and also improves snapshot trust, because the currently visible frame remains defined during reload instead of collapsing into a blank or transient state.

#### Honest degraded snapshot fallback

Snapshot capture should wait for the active `WKWebView` content to reach a defined ready state when possible. If readiness is not confirmed before timeout, the viewer may still capture the currently visible frame, but that response must be marked as degraded and include a warning that the image may be stale or incomplete.

If no visible frame exists at all, snapshot capture should still fail clearly instead of fabricating success.

#### Compositor-aware native capture

For native viewer-backed snapshots, `WKWebView` content must be captured from the composited visible presentation rather than from a view-cache path that can omit or blank web content. A snapshot that does not reflect the actually visible frame is worse than an honest degraded result, because it overstates trust in the artifact.

#### Implementation shape

To keep this slice testable without introducing heavyweight UI automation, the readiness lifecycle should be concentrated in a small Swift coordinator that can be unit-tested independently of `WKWebView`. `ViewerModel` and `SurfaceView` should then use that coordinator to drive overlay state, reload timing, and snapshot decisions.

TypeScript-side changes should stay small and focused on surfacing capture metadata and warning text through the existing CLI and result transport, plus any test-isolation hooks needed to keep CLI coverage deterministic while a real native viewer is running.

### Optional minimal chrome

A very small amount of viewer chrome may be appropriate if it improves clarity, for example:
- title
- surface type
- updated timestamp

This should remain lightweight and secondary to the surface itself.

The implemented version of this chrome may include a title, type badge, and updated timestamp as long as it remains clearly subordinate to the surface body.

### Non-goal guardrail

This change must not drift into:
- tabs
- workspace management
- in-view editing
- heavy controls
- spreadsheet UX
- decorative animation for its own sake

### Follow-up risk

The current compositor-aware native snapshot fix depends on a CoreGraphics whole-window capture API that is deprecated on macOS 14. That tradeoff is acceptable for this change because it restores truthful `WKWebView` snapshot artifacts, but the capture path should be revisited in a future follow-up.
