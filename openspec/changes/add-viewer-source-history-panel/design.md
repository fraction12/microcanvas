## Design

### Storage

Store source history as metadata in the user application-support area by default:

- macOS: `~/Library/Application Support/Microcanvas/source-history.json`
- test/dev override: environment variable for the exact history file path

The file stores only paths and lightweight metadata. It must not copy source documents, generated visuals, or staged artifacts. This keeps private user file paths out of git-controlled repo state and avoids adding source content to temp or runtime directories.

History records are:

- canonical source path
- display name
- source file name
- source kind/render mode/content type when known
- last shown timestamp
- show count
- whether the source originally lived outside the repo

The list is deduped by canonical path, newest first, and capped at 50 records after every write.

### Recording

Record history after a successful source-backed show/update path has produced a manifest. This should use the manifest source metadata so the history entry reflects the source path that fed the staged presentation artifact.

Do not record:

- missing/unsupported failed attempts
- direct staged-surface-id activation with no source-backed render
- snapshot/verify/status operations

### Viewer Panel

The macOS viewer reads the history file and displays it in a collapsible leading panel. The panel should:

- default collapsed to preserve the existing canvas-first view
- list newest items first
- show concise file names with path context
- mark entries disabled when the original file no longer exists
- let available entries be clicked to reload

The panel should avoid reading original source contents. It only checks file existence for display state and passes the selected path back into the CLI show flow.

### Reload Bridge

When a user clicks an available history entry, the viewer invokes the existing CLI show path from the repo root:

```text
MICROCANVAS_DISABLE_NATIVE_VIEWER=1 node dist/cli/index.js show <source-path> --json
```

This keeps render adapters, ingest validation, staging, promotion, locks, and result contracts in the TypeScript runtime. Because the click originates inside the live native viewer, the child CLI process should update the runtime without trying to launch or verify another viewer session. The native viewer should treat the process as an async reload request and keep the current surface visible until the normal runtime polling observes the updated active surface.

If the CLI cannot be found or the command fails, the viewer surfaces a concise status message and leaves the current surface untouched.

### Security and Privacy

History paths are private local metadata. They are not written under git-tracked source paths, and the viewer does not grant web content read access to original source locations. Clicking history is equivalent to the user running `microcanvas show <path>` again.

### Testing

Add TypeScript tests for:

- app-support history path override
- dedupe/newest-first behavior
- 50-entry cap
- successful show/update history recording

Add Swift tests for:

- history decoding and missing-file state
- process command construction for CLI reload
- side-panel state or model-level history refresh where practical

Run TypeScript checks/tests and Swift viewer tests when practical.
