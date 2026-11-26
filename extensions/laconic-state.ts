// Project-scoped persistence for laconic mode.
// This is a workaround until Pi exposes SettingsManager to extensions
// (tracked upstream as pi-coding-agent issue #4981).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { normalizeMode, type StoredMode } from "./laconic-core.ts";

const STATE_DIR = ".pi";
const STATE_FILE = "laconic-mode.json";

function statePath(cwd: string): string {
	return join(cwd, STATE_DIR, STATE_FILE);
}

// Mirrors getAgentDir() from the Pi SDK, which laconic.ts may import as types only.
function agentDir(): string {
	const dir = process.env.PI_CODING_AGENT_DIR;
	if (!dir) return join(homedir(), STATE_DIR, "agent");
	if (dir === "~") return homedir();
	return dir.startsWith("~/") ? join(homedir(), dir.slice(2)) : dir;
}

function readMode(path: string): StoredMode | undefined {
	if (!existsSync(path)) return undefined;
	try {
		const raw = JSON.parse(readFileSync(path, "utf8"));
		return normalizeMode(raw.mode);
	} catch {
		return undefined;
	}
}

/**
 * Load the project-scoped laconic mode default. Returns `undefined` when no
 * state file exists or it cannot be read, so the caller can fall back to the
 * global default.
 */
export function loadProjectMode(cwd: string): StoredMode | undefined {
	return readMode(statePath(cwd));
}

/**
 * Load the user-wide laconic mode default from `<agent dir>/laconic-mode.json`
 * (`~/.pi/agent` unless `PI_CODING_AGENT_DIR` is set). Used when neither the
 * session nor the project sets a mode.
 */
export function loadGlobalMode(): StoredMode | undefined {
	return readMode(join(agentDir(), STATE_FILE));
}

/**
 * Persist the laconic mode for this project directory. Returns `true` on
 * success; failures are silent so that session operation is never blocked by
 * disk issues.
 */
export function saveProjectMode(cwd: string, mode: StoredMode): boolean {
	try {
		const dir = join(cwd, STATE_DIR);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(
			statePath(cwd),
			JSON.stringify({ mode, updatedAt: Date.now() }, null, 2),
		);
		return true;
	} catch {
		return false;
	}
}
