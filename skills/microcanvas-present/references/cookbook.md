# Microcanvas Agent Cookbook

Use these patterns when an agent needs to present work instead of describing it badly in chat.

## 1. First visual review

Goal: show an artifact for the first time.

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh show /absolute/path/to/file --json
```

Then inspect:
- `ok`
- `record.viewer.mode`
- `record.artifacts.primary`

## 2. Update the thing already on screen

Goal: keep the same presentation flow while refreshing content.

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh update /absolute/path/to/file --json
```

Prefer this over `show` when iterating on the same artifact.

## 3. Stage without opening

Goal: prepare a surface artifact without switching the viewer yet.

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh render /absolute/path/to/file --json
```

## 4. Check whether native verification is actually available

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh status --json
```

Interpretation:
- `native` -> strict verify/snapshot paths are available
- `degraded` -> visible presentation may be fine, but do not claim native verification
- `closed` -> there is no confirmed viewer session

## 5. Ask for strict confirmation

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh verify --json
```

Use only when strict viewer-backed confirmation matters.

## 6. Capture a real PNG

```bash
skills/microcanvas-present/scripts/run-microcanvas.sh snapshot --json
```

Use only when `viewer.mode` is `native`.

## 7. Recover from common mistakes

### Mistake: used `update` before anything was active
Use `show` first.

### Mistake: user asked for a visual and the agent dumped markdown/ASCII into chat
Stop. Use `show` on the real file.

### Mistake: command succeeded in degraded mode
That is still a successful presentation path, but do not claim strict verification or native snapshot support.

### Mistake: unsupported file type
Convert deliberately, or surface `UNSUPPORTED_CONTENT` honestly.
