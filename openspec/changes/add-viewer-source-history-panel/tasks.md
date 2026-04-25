## 1. OpenSpec

- [x] 1.1 Validate the proposal, design, and spec deltas for source history.

## 2. TypeScript History Store

- [x] 2.1 Add a private application-support history path with a test override.
- [x] 2.2 Implement metadata-only read/write helpers with canonical-path dedupe, newest-first ordering, and a 50-entry cap.
- [x] 2.3 Record successful source-backed show/update operations from manifest source metadata.
- [x] 2.4 Add regression tests for path override, dedupe, cap, and show/update recording.

## 3. macOS Viewer

- [x] 3.1 Add Swift history record/store decoding with missing-file availability checks.
- [x] 3.2 Add a collapsible side panel listing recent history newest first.
- [x] 3.3 Invoke the existing CLI `show <path> --json` flow with native launch disabled when an available entry is selected.
- [x] 3.4 Keep the current surface visible and report a concise status if reload fails.
- [x] 3.5 Add Swift tests for history decoding and CLI reload command construction.

## 4. Validation

- [x] 4.1 Run `npm run check`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run Swift viewer tests where practical.
- [x] 4.4 Validate `add-viewer-source-history-panel` with OpenSpec strict validation.
