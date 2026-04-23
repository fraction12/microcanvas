## Design

The core issue is a fidelity mismatch between the live web viewer and the snapshot/export pipeline.

The live viewer already renders Mermaid correctly, so the bug is not diagram generation. The failure is in how snapshot/export captures the web surface: it must wait for the rendered SVG to exist, then rasterize or capture the painted result itself.

### Design principles

1. **Snapshot what the user sees**
   - Snapshot/export should reflect the painted diagram, not the source text or an intermediate blank state.

2. **Wait for readiness explicitly**
   - Mermaid surfaces should expose a concrete ready signal before export begins.
   - Snapshot capture should not race the render lifecycle.

3. **Preserve orientation and layout**
   - The exported image must keep the same upright orientation and visible content as the live viewer.

4. **Keep the fix local**
   - Do not change Mermaid input semantics or live viewer rendering unless required for export correctness.

### Likely implementation direction

- Keep Mermaid rendering in the page/viewer path.
- Add or strengthen a readiness signal for when the SVG has been painted.
- Have the snapshot path capture the painted content after readiness, rather than grabbing an empty export frame.
- Add regression coverage using the existing Mermaid fixture and snapshot output.

### Test strategy

- Verify a Mermaid fixture renders visibly in the live viewer.
- Verify the snapshot PNG is not blank.
- Verify the exported snapshot preserves upright orientation.
- Keep the broader CLI/viewer suite green.
