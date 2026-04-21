## 1. Last-good persistence

- [ ] 1.1 Add a native last-good surface store for saving and restoring the last promoted surface.
- [ ] 1.2 Restore the last good surface during viewer startup when its artifact still exists.
- [ ] 1.3 Fail closed to placeholder state when the persisted artifact can no longer be recovered.

## 2. Sticky presentation policy

- [ ] 2.1 Keep the last presented surface visible when runtime state clears or no newer surface is ready.
- [ ] 2.2 Prevent failed or incomplete refreshes from evicting the current presented surface.
- [ ] 2.3 Keep status messaging accurate while the viewer is holding prior content.

## 3. Supported snapshot capture

- [ ] 3.1 Replace deprecated whole-window capture with supported surface-aware snapshotting.
- [ ] 3.2 Capture `wkwebview` snapshots from the presented web view rather than the enclosing window.
- [ ] 3.3 Capture image and PDF snapshots from their presented surface paths.
- [ ] 3.4 Preserve honest `fresh`, `degraded`, and `failedNoVisibleFrame` reporting.

## 4. Verification

- [ ] 4.1 Add native tests for last-good persistence and restore behavior.
- [ ] 4.2 Add native tests for sticky promotion policy and hold behavior.
- [ ] 4.3 Add CLI regression coverage for degraded snapshots captured from held last-good content.
- [ ] 4.4 Run manual native-viewer smoke for hold-on-clear, relaunch-restore, and surface-aware snapshot capture.
