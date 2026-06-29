# caveman-help

Quick-reference card. One shot, no mode change.

## What it does

Prints a cheat sheet of all caveman modes, sibling skills, deactivation
triggers, and how mode persists: it is stored as a session entry (survives
`/reload`), and since v0.4.3 it is also saved per project in
`.pi/caveman-mode.json` (a new session in the same project directory restores
the last mode). No config file? Falls back to `off`. One-shot display — does not
flip the active mode, write flag files, or persist anything. Use when you forget
the slash commands.

## How to invoke

```
/caveman-help
```

Also triggers on "caveman help", "what caveman commands", "how do I use caveman".

## Example output

```
Modes:
  /caveman              full (default)
  /caveman lite         lighter
  /caveman ultra        extreme
  /caveman wenyan       classical Chinese

Skills:
  /caveman-commit       terse Conventional Commits
  /caveman-review       one-line PR comments
  /caveman-stats        session token savings

Deactivate:
  "stop caveman" or "normal mode"
```

## See also

- [`SKILL.md`](./SKILL.md) — full reference card
- [Caveman README](../../README.md) — repo overview
