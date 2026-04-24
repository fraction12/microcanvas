## Why

Microcanvas now has a credible runtime model, native viewer, image support, CSV/table support, viewer-backed snapshots, and a cleaner internal surface adapter structure. The next quality bottleneck is not capability breadth, but viewer feel.

The tool can now show useful surfaces, but the viewer still risks feeling like a thin file opener rather than a deliberate product surface. The next change should improve presentation, empty/error states, and viewer confidence without turning the app into a bloated workspace manager.

## What changes

This change focuses on viewer polish in three tight areas:

1. Improve presentation for supported surface families, especially images and tables.
2. Add clearer empty, fallback, and error states so the app feels intentional instead of accidental.
3. Improve load/reload and snapshot confidence so captures and updates happen against visibly ready content.

The first implementation slice for this change will start with load/reload and snapshot confidence for `WKWebView` surfaces. That slice will introduce a hybrid update path that keeps the last ready frame visible while refreshed web content loads, and it will make snapshot responses honest about whether the captured image is fresh or degraded.

## Non-goals

- No multi-window or tabbed workspace model.
- No editing or authoring surface inside the viewer.
- No heavy toolbar or IDE-style chrome.
- No spreadsheet-style interactivity for tables.
- No broad new surface-family expansion in this change.

## Success criteria

- Image and table surfaces feel noticeably more deliberate and readable.
- Empty/fallback/error states are clear and intentional.
- Snapshot behavior has stronger load-state confidence and native viewer captures remain visually trustworthy for image and `wkwebview` surfaces.
- Manual native-viewer smoke on tracked fixtures produces readable snapshot PNG artifacts, with degraded or failed states surfaced explicitly when freshness cannot be guaranteed.
- Viewer polish improves experience without distorting the small, deterministic product shape.
