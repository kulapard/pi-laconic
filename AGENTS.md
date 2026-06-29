# AGENTS.md — pi-caveman conventions

Project memory. Non-obvious only.

## Architecture (do not rebuild)

- `extensions/caveman.ts` = Pi extension. `extensions/caveman-core.ts` = pure SDK-free logic (`normalizeMode`, `modeInstructions`, `VALID_MODES`, regexes). Unit-testable without fake SDK.
- Mode state **session-scoped**: `pi.appendEntry("caveman-mode", …)`, restored from `ctx.sessionManager.getBranch()` on `session_start`. New session always `off`. No cross-session config/env.
- Activation = `before_agent_start` appends `modeInstructions(mode)`. Statusline = `ctx.ui.setStatus("caveman", …)` guarded by `hasUI`.
- Extension `modeInstructions` = **canonical** activator. `skills/caveman/SKILL.md` = fallback for hosts loading skills but not extension. If both active, model sees both rule sets — intentional redundancy, no de-dupe.
- Pi 0.80.2 has **no `agents/` subagent mechanism**. `agents/cavecrew-*.md` = reference personas only; cavecrew optional/out-of-scope.

## Invariants

- **SDK import `import type` only** in `extensions/*.ts`. JS tests run via `--experimental-strip-types`, erases type-only imports. Value import from `@earendil-works/pi-coding-agent` breaks tests — `tests/extension.test.mjs` asserts this.
- **Verbatim preservation**: caveman-compress never changes code blocks, inline code, URLs, paths, commands, exact error strings. Skill instructs self-validate against original. Mismatch unfixable → restore from `.original` backup created in same invocation (stale backups rejected before compression).
- `caveman-compress` is **prompt-only**: Pi agent compresses with own model + file tools, driven by `SKILL.md`. No Python, no external model CLI. Coverage = `tests/compress-docs.test.mjs`.

## Changelog

Every notable change must update `CHANGELOG.md` under `[Unreleased]`. Before finishing task, run `npm run changelog:check` to confirm changelog updated for files changed. CI runs same check on every PR.

- `npm test` runs `pretest` (`npm run typecheck` → `tsc --noEmit`), then `node --test tests/**/*.test.mjs`. Typecheck failures fail test run.
- Node `--test` glob expanded by runner, not shell. Directory-recursion `--test tests/` does **not** work on current Node — keep glob.
- Tests are **phantom-reference guards** (`tests/stats-docs.test.mjs`, `tests/cavecrew-docs.test.mjs`, `tests/compress-docs.test.mjs`): docs must not mention Claude-Code hooks layer, plugin install path, `⛏` badge, Claude-only subagent presets, broken asset paths. Do not reintroduce.
