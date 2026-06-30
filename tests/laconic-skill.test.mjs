import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const skillPath = join(repoRoot, "skills", "laconic", "SKILL.md");

test("laconic/SKILL.md handles commit/PR output consistently with removed skills", () => {
	const content = readFileSync(skillPath, "utf8");
	// The laconic-commit and laconic-review skills were removed in v1.1.0.
	// The base skill must not delegate to them or otherwise contradict its own
	// terse-output rules for commits/PRs.
	assert.doesNotMatch(
		content,
		/\b(Code\/commits\/PRs|commits\/PRs):\s*write normal\b/,
		"SKILL.md must not tell the agent to write commits/PRs in normal mode",
	);
	assert.doesNotMatch(
		content,
		/laconic-commit/,
		"SKILL.md must not reference the removed laconic-commit skill",
	);
	assert.doesNotMatch(
		content,
		/laconic-review/,
		"SKILL.md must not reference the removed laconic-review skill",
	);
});
