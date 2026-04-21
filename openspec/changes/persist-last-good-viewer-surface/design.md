## Design

This follow-up should make the viewer feel persistent and trustworthy, not more complicated.

### Design principles

1. **Hold something useful**
   - Once the viewer has successfully shown a surface, it should prefer holding that visual over dropping to blank or empty states.
   - The user should lose a visual only when the app can no longer honestly recover it.

2. **Promote only on success**
   - New runtime content becomes visible only when it is actually ready for presentation.
   - Failed or incomplete updates should not evict the last good surface.

3. **Capture the presented surface, not the whole window**
   - Snapshot behavior should follow the actual surface being shown.
   - Deprecated whole-window capture should be replaced with surface-aware APIs.

### Wedge A: Last-good presentation persistence

The native viewer should maintain a `last good presentation` model.

That model has two parts:
- an in-memory presented surface that remains visible until a newer surface is promoted
- a small persisted record that allows the viewer to restore the last good surface after relaunch

The persisted record should include only the information needed to reopen the last promoted surface safely, such as:
- surface id
- render mode
- title
- updated timestamp
- resolved artifact path

If the artifact no longer exists, the restore should fail closed and the viewer may show its normal placeholder state.

### Wedge B: Sticky promotion policy

The viewer should no longer interpret transient runtime emptiness as permission to clear the canvas.

Instead:
- missing active manifest
- no active surface in runtime state
- failed refresh
- pending content that never becomes ready

should all resolve to:
- keep showing the last good surface
- update status/chrome text to explain that newer content is not ready

This keeps the viewer aligned with the rule "show the last useful visual until something better is ready."

#### Promotion flow

```text
poll runtime state
      |
      v
new candidate available?
      |
   yes|                         no / missing / invalid
      v                              |
stage pending -----------------------+
      |
ready?
  |   \
yes    no / fail / timeout
  |           |
  v           v
promote       hold current presented surface
  |
  v
persist last-good record
```

### Wedge C: Supported surface-aware snapshot capture

Snapshot capture should move from whole-window capture to a `presented surface snapshotter`.

That snapshotter should operate against the currently presented surface:

- `wkwebview`
  - Use `WKWebView.takeSnapshot(...)` against the visible, promoted web view.
  - If a newer pending web view exists but has not yet been promoted, snapshot the older promoted view and report degraded state when appropriate.

- `image`
  - Capture from the presented image surface path or rendered image representation rather than the enclosing app window.

- `pdf`
  - Capture from the presented PDF surface through PDF-backed rendering rather than window capture.

This preserves truthful snapshots while removing the macOS 14 deprecation risk from the old CoreGraphics window path.

### Wedge D: Honest degraded semantics

The existing `fresh`, `degraded`, and `failedNoVisibleFrame` outcomes still work, but their meaning tightens:

- `fresh`
  - the snapshot reflects the currently presented live surface that matches the latest ready content

- `degraded`
  - the snapshot reflects a valid, currently held last-good surface rather than the newest requested content

- `failedNoVisibleFrame`
  - the viewer has neither a ready current surface nor a recoverable last-good presentation to capture

That means degraded snapshots remain honest without overstating freshness.

### Implementation shape

Keep the implementation narrow by introducing three small responsibilities:

1. `LastGoodSurfaceStore`
   - native persistence helper for reading and writing the last-good surface record

2. `PresentedSurfaceSnapshotter`
   - native snapshot helper that switches on the currently presented surface type

3. `ViewerModel` promotion policy update
   - coordinate restore, hold, promote, and persist decisions

`SurfaceView` should continue to own view-specific presentation mechanics, while `ViewerModel` remains the place that decides whether a new surface is allowed to replace the old one.

### Edge cases

- If the persisted last-good artifact has been deleted, the viewer falls back to its placeholder state.
- If runtime points to a new surface that never becomes ready, the old surface remains visible.
- If the viewer relaunches after the CLI exits, it restores the last good surface and waits for newer content.
- If a newer surface becomes ready, it replaces the old one immediately and becomes the new persisted last-good record.

### Non-goal guardrail

This change must not drift into:
- browsing prior surfaces
- long-lived revision history UX
- pinning arbitrary visuals manually
- screenshot galleries
- heavy viewer controls
