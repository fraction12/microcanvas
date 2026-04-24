Implementation note: start with the approved first slice for `WKWebView` reload and snapshot readiness before broadening the same model to PDF or image surfaces. See `implementation-plan.md` in this change directory for the execution plan.

## 1. Surface presentation polish

- [x] 1.1 Improve image-surface layout and framing in the viewer.
- [x] 1.2 Improve table-surface readability and overflow handling.
- [x] 1.3 Improve the presentation quality of generated HTML-like surfaces where appropriate.

## 2. Viewer fallback and empty states

- [x] 2.1 Add an intentional no-active-surface state.
- [x] 2.2 Add clearer fallback/error states for unsupported render mode or missing active content.
- [x] 2.3 Keep fallback messaging concise and product-like.

## 3. Load and snapshot confidence

- [x] 3.1 Add a `WKWebView`-first readiness state model that distinguishes loading, ready, and degraded viewer states.
- [x] 3.2 Keep the last ready `WKWebView` content visible while refreshed content loads, with lightweight updating treatment.
- [x] 3.3 Extend the snapshot handshake so captures can report fresh or degraded readiness with an explicit warning when fallback is used.
- [x] 3.4 Add verification or regression coverage for readiness transitions and degraded snapshot reporting.

## 4. Optional minimal chrome

- [x] 4.1 Evaluate whether a very small header with title/type/time improves clarity.
- [x] 4.2 Keep any added chrome lightweight and secondary to the surface.

## 5. Validation

- [x] 5.1 Validate the OpenSpec change.
- [x] 5.2 Keep the polish work aligned with the product’s small deterministic shape.
- [x] 5.3 Run live native-viewer smoke on tracked image and `wkwebview` fixtures.
- [x] 5.4 Verify snapshot PNG artifacts contain visible viewer content and continue to report degraded or failed states honestly when freshness is not guaranteed.
