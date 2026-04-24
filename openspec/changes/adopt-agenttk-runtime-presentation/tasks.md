## 1. Runtime delegation decision

- [ ] 1.1 Decide whether unknown commands keep returning `UNKNOWN_COMMAND` or switch to AgentTK help fallback.
- [ ] 1.2 Prototype `runToolCli` against the current command table and compare JSON/human output.
- [ ] 1.3 Choose whether to wrap AgentTK runtime behavior, extend AgentTK upstream, or accept the default behavior.

## 2. Presentation decision

- [ ] 2.1 Compare AgentTK presentation hooks against current Microcanvas human output requirements.
- [ ] 2.2 Decide whether branded/humanized output remains supported.
- [ ] 2.3 Update presentation tests to lock the chosen output contract.

## 3. Implementation

- [ ] 3.1 Centralize/export the Microcanvas tool definition if needed.
- [ ] 3.2 Adopt `runToolCli` or document why Microcanvas keeps custom dispatch.
- [ ] 3.3 Remove dead custom presentation or dispatch code only after tests prove behavior is intentionally preserved or changed.

## 4. Validation

- [ ] 4.1 Run TypeScript checks.
- [ ] 4.2 Run the CLI and presentation test suites.
- [ ] 4.3 Validate the OpenSpec change.
