#!/usr/bin/env node
// Enforce that CHANGELOG.md is updated for every notable change.
// Usage:
//   node scripts/check-changelog.mjs --staged           # check staged files
//   node scripts/check-changelog.mjs --base origin/main # CI/PR check

import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
	options: {
		base: { type: "string", default: "HEAD" },
		staged: { type: "boolean", default: false },
	},
	allowPositionals: false,
});

function getFiles() {
	try {
		if (values.staged) {
			return execSync("git diff --cached --name-only", { encoding: "utf8" })
				.trim()
				.split("\n")
				.filter(Boolean);
		}
		return execSync(`git diff --name-only ${values.base}...HEAD`, {
			encoding: "utf8",
		})
			.trim()
			.split("\n")
			.filter(Boolean);
	} catch (err) {
		console.error("Failed to list changed files:", err.message);
		process.exit(1);
	}
}

const files = getFiles();
const otherFiles = files.filter((file) => file !== "CHANGELOG.md");
const changelogChanged = files.includes("CHANGELOG.md");

if (otherFiles.length > 0 && !changelogChanged) {
	console.error("CHANGELOG.md must be updated when files change.");
	console.error("\nFiles changed:");
	for (const file of otherFiles) console.error(`  - ${file}`);
	console.error(
		"\nAdd an entry under [Unreleased] in CHANGELOG.md and stage it.",
	);
	process.exit(1);
}

console.log(
	otherFiles.length > 0
		? "CHANGELOG.md updated for file changes."
		: "No file changes; changelog check skipped.",
);
