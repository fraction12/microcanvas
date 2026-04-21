## 1. Project bootstrap

- [ ] 1.1 Create the initial repository structure for Microcanvas.
- [ ] 1.2 State clearly that Microcanvas is meant to cover the same core job as OpenClaw Canvas, but in a lighter and more reliable form.
- [ ] 1.3 State clearly that Microcanvas owns the viewer/runtime and does not depend on the OpenClaw Mac app.
- [ ] 1.4 Initialize OpenSpec and create the initial canonical specs.

## 2. Runtime model

- [ ] 2.1 Define the file-first render/session model.
- [ ] 2.2 Define the standalone app viewer as the default runtime path.
- [ ] 2.3 Keep one shared render/session model regardless of which agent invoked the tool.
- [ ] 2.4 Preserve a clean separation between rendering surfaces and displaying them.
- [ ] 2.5 Support exactly one active surface at a time in v1.
- [ ] 2.6 Add explicit write-lock semantics so only one caller can mutate the active surface at a time.
- [ ] 2.7 Return a clear try-again-later response when another caller hits the lock.
- [ ] 2.8 Allow the tool to show broad viewable artifacts rather than narrowly restricting content types.
- [ ] 2.9 Define the canonical surface root layout, including active, staging, snapshots, and runtime-state files.
- [ ] 2.10 Define the active surface manifest and its required metadata.
- [ ] 2.11 Define how render, show, update, and snapshot map onto filesystem state.
- [ ] 2.12 Define atomic swap expectations for promoting staged content into the active surface.

## 3. Tool interface

- [ ] 3.1 Define an AgentTK-based CLI for `render`, `show`, `update`, `snapshot`, `verify`, and `status`.
- [ ] 3.2 Keep the API small enough that OpenClaw agents and other coding tools can drive it easily.
- [ ] 3.3 Ensure the surface is lighter and more deterministic than the current OpenClaw Canvas ergonomics.
- [ ] 3.4 Define strict path-safety behavior for rendered surface resolution.
- [ ] 3.5 Avoid agent-specific behavior in the core tool contract.
- [ ] 3.6 Define stable machine-readable CLI outputs for success, lock contention, invalid input, unsupported content, viewer failures, and verification failures.
- [ ] 3.7 Define exact replacement semantics for `show` and `update`.
- [ ] 3.8 Define which commands are mutating and therefore require the write lock.
- [ ] 3.9 Define supported input modes such as file path, artifact path, and stdin where appropriate.

## 4. Viewer behavior

- [ ] 4.1 Define the single-window viewer behavior for v1.
- [ ] 4.2 Explicitly mark history, multiple active surfaces, and workspace management as non-goals.
- [ ] 4.3 Define what broad viewable content means operationally, including which content is natively supported vs transformed before display.
- [ ] 4.4 Define viewer reuse behavior when a new surface is shown while the window is already open.
- [ ] 4.5 Define the macOS-first viewer implementation path.
- [ ] 4.6 Prefer a native macOS app plus lightweight platform rendering primitives over a heavy app shell.
- [ ] 4.7 Define the supported display paths for HTML-like content, PDF, and transformed artifacts.

## 5. Verification

- [ ] 5.1 Validate the OpenSpec change.
- [ ] 5.2 Keep the initial architecture intentionally lightweight.
