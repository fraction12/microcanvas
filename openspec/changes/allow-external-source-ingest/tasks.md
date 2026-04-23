## 1. Source-path acceptance

- [ ] 1.1 Update the source-path validation flow so supported local files outside the repo root can be accepted for ingest.
- [ ] 1.2 Keep rejection paths clear for missing files, unsupported content, unsupported schemes, and invalid local paths.
- [ ] 1.3 Decide and document the initial symlink policy for external ingest.

## 2. Ingest and staging flow

- [ ] 2.1 Add an explicit ingest step that copies or materializes the caller-provided source into a Microcanvas-owned staged surface location.
- [ ] 2.2 Ensure render/show/update operate from the staged copy or generated artifact, not from the original source path.
- [ ] 2.3 Preserve deterministic artifact generation for supported content families.

## 3. Runtime metadata

- [ ] 3.1 Extend manifest/runtime metadata so tools can understand source-versus-staged behavior.
- [ ] 3.2 Record enough source metadata for operator/tool inspection without making the viewer depend on the original path.
- [ ] 3.3 Keep JSON command contracts stable while adding any useful new fields.

## 4. Update semantics

- [ ] 4.1 Define and implement the `update <path>` flow for replacing the active surface from a newly ingested source path.
- [ ] 4.2 Keep active surface identity and promotion behavior coherent under the ingest model.
- [ ] 4.3 Decide whether remembered-original-path refresh is in scope now or deferred.

## 5. Security invariants

- [ ] 5.1 Preserve the staged-directory-only presentation boundary for the native viewer.
- [ ] 5.2 Confirm HTML-like safety defaults still apply to externally ingested HTML-like content.
- [ ] 5.3 Ensure external ingest does not widen local read access for the viewer.

## 6. Validation

- [ ] 6.1 Add regression tests for supported external source paths.
- [ ] 6.2 Add regression tests for update behavior with external source replacements.
- [ ] 6.3 Add or keep regression tests for symlink-policy and invalid-path behavior.
- [ ] 6.4 Run `npm test` and relevant viewer validation.
- [ ] 6.5 Validate the OpenSpec change.

## 7. Documentation

- [ ] 7.1 Update README examples so users understand they can point Microcanvas at supported files from anywhere.
- [ ] 7.2 Document the source-versus-presentation model clearly.
- [ ] 7.3 Explain the security posture: flexible ingest, narrow presentation boundary.