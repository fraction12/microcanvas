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

### Optional minimal chrome

A very small amount of viewer chrome may be appropriate if it improves clarity, for example:
- title
- surface type
- updated timestamp

This should remain lightweight and secondary to the surface itself.

### Non-goal guardrail

This change must not drift into:
- tabs
- workspace management
- in-view editing
- heavy controls
- spreadsheet UX
- decorative animation for its own sake
