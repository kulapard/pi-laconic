import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
	normalizeMode,
	modeInstructions,
	VALID_MODES,
	ACTIVATION_RE,
	DEACTIVATION_RE,
} from "../extensions/caveman-core.ts";
import cavemanExtension from "../extensions/caveman.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const ALL_MODES = [
	"lite",
	"full",
	"ultra",
	"wenyan-lite",
	"wenyan-full",
	"wenyan-ultra",
];

// --- normalizeMode mapping table ---

test("normalizeMode: empty / whitespace -> full", () => {
	assert.equal(normalizeMode(undefined), "full");
	assert.equal(normalizeMode(""), "full");
	assert.equal(normalizeMode("   "), "full");
	assert.equal(normalizeMode("\t\n"), "full");
});

test("normalizeMode: off-like aliases -> off", () => {
	for (const alias of [
		"off",
		"stop",
		"normal",
		"normal-mode",
		"disable",
		"disabled",
		"OFF",
		"  Stop  ",
	]) {
		assert.equal(normalizeMode(alias), "off", `alias=${JSON.stringify(alias)}`);
	}
});

test("normalizeMode: wenyan / classical -> wenyan-full", () => {
	assert.equal(normalizeMode("wenyan"), "wenyan-full");
	assert.equal(normalizeMode("classical"), "wenyan-full");
	assert.equal(normalizeMode("  WENYAN "), "wenyan-full");
});

test("normalizeMode: each valid mode maps to itself", () => {
	for (const mode of ALL_MODES) {
		assert.equal(normalizeMode(mode), mode, `mode=${mode}`);
		assert.equal(normalizeMode(mode.toUpperCase()), mode, `upper mode=${mode}`);
	}
});

test("normalizeMode: garbage -> undefined", () => {
	for (const junk of ["banana", "lite-mode", "wenyan-mega", "123", "fullish"]) {
		assert.equal(
			normalizeMode(junk),
			undefined,
			`junk=${JSON.stringify(junk)}`,
		);
	}
});

test("VALID_MODES contains exactly the six intensity modes", () => {
	assert.equal(VALID_MODES.size, 6);
	for (const mode of ALL_MODES) {
		assert.ok(VALID_MODES.has(mode), `VALID_MODES missing ${mode}`);
	}
});

// --- modeInstructions ---

test("modeInstructions: contains the active banner and per-mode line for every mode", () => {
	const perModeNeedle = {
		lite: "Intensity: lite.",
		full: "Intensity: full.",
		ultra: "Intensity: ultra.",
		"wenyan-lite": "Intensity: wenyan-lite.",
		"wenyan-full": "Intensity: wenyan-full.",
		"wenyan-ultra": "Intensity: wenyan-ultra.",
	};
	for (const mode of ALL_MODES) {
		const text = modeInstructions(mode);
		assert.match(
			text,
			/CAVEMAN MODE ACTIVE/,
			`mode=${mode} missing CAVEMAN MODE ACTIVE`,
		);
		assert.ok(
			text.includes(perModeNeedle[mode]),
			`mode=${mode} missing per-mode line "${perModeNeedle[mode]}"`,
		);
	}
});

// --- activation / deactivation regexes ---

test("ACTIVATION_RE matches documented activation phrases", () => {
	for (const phrase of [
		"caveman mode",
		"please use caveman mode now",
		"talk like caveman",
		"use caveman",
		"can we use less tokens",
		"fewer tokens please",
		"save tokens",
	]) {
		assert.match(phrase, ACTIVATION_RE, `should activate: ${phrase}`);
	}
});

test("ACTIVATION_RE does not match innocuous text", () => {
	for (const phrase of [
		"let's talk about the cavemen exhibit",
		"the token bucket algorithm",
		"normal conversation about caves",
		"I want more tokens not less",
	]) {
		// "less tokens"/"fewer tokens"/"save tokens" are the only token phrases;
		// none of the above contain an activation trigger as a whole phrase.
		assert.doesNotMatch(phrase, ACTIVATION_RE, `should NOT activate: ${phrase}`);
	}
});

test("DEACTIVATION_RE matches documented deactivation phrases", () => {
	for (const phrase of [
		"stop caveman",
		"please stop caveman now",
		"switch to normal mode",
		"disable caveman",
	]) {
		assert.match(phrase, DEACTIVATION_RE, `should deactivate: ${phrase}`);
	}
});

test("DEACTIVATION_RE does not match innocuous text", () => {
	for (const phrase of [
		"the caveman is friendly",
		"this is a normal day",
		"enable caveman please",
	]) {
		assert.doesNotMatch(
			phrase,
			DEACTIVATION_RE,
			`should NOT deactivate: ${phrase}`,
		);
	}
});

// --- fake-pi handler tests ---

function makeFakePi() {
	const events = new Map();
	const commands = new Map();
	const appended = [];
	const messages = [];
	const userMessages = [];
	const pi = {
		on(event, handler) {
			events.set(event, handler);
		},
		registerCommand(name, def) {
			commands.set(name, def);
		},
		appendEntry(customType, data) {
			appended.push({ customType, data });
		},
		sendMessage(msg) {
			messages.push(msg);
		},
		sendUserMessage(msg) {
			userMessages.push(msg);
		},
	};
	return { pi, events, commands, appended, messages, userMessages };
}

function makeFakeCtx(branch = []) {
	const notifications = [];
	const statuses = [];
	return {
		ctx: {
			hasUI: true,
			ui: {
				setStatus(key, value) {
					statuses.push({ key, value });
				},
				notify(message, level) {
					notifications.push({ message, level });
				},
			},
			sessionManager: {
				getBranch() {
					return branch;
				},
			},
		},
		notifications,
		statuses,
	};
}

test("before_agent_start: returns undefined when mode off", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const handler = fake.events.get("before_agent_start");
	assert.ok(handler, "before_agent_start handler must be registered");
	// default mode is off
	const result = handler({ systemPrompt: "SYS" });
	assert.equal(result, undefined);
});

test("before_agent_start: appends modeInstructions when a mode is active", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx } = makeFakeCtx();

	// activate ultra via the /caveman command handler
	const caveman = fake.commands.get("caveman");
	caveman.handler("ultra", ctx);

	const handler = fake.events.get("before_agent_start");
	const result = handler({ systemPrompt: "SYS" });
	assert.ok(result, "should return an override object when active");
	assert.ok(result.systemPrompt.startsWith("SYS\n\n"));
	assert.match(result.systemPrompt, /CAVEMAN MODE ACTIVE/);
	assert.ok(result.systemPrompt.includes("Intensity: ultra."));
});

test("session_start: restores the LAST caveman-mode entry from the branch", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const branch = [
		{ type: "custom", customType: "caveman-mode", data: { mode: "lite" } },
		{ type: "message", customType: undefined, data: {} },
		{ type: "custom", customType: "caveman-mode", data: { mode: "ultra" } },
		{ type: "custom", customType: "other", data: { mode: "full" } },
	];
	const { ctx, statuses } = makeFakeCtx(branch);
	const handler = fake.events.get("session_start");
	handler({}, ctx);

	// last caveman-mode entry was ultra -> before_agent_start should reflect ultra
	const beforeStart = fake.events.get("before_agent_start");
	const result = beforeStart({ systemPrompt: "SYS" });
	assert.ok(result.systemPrompt.includes("Intensity: ultra."));
	// statusline reflects ultra
	assert.deepEqual(statuses.at(-1), { key: "caveman", value: "caveman:ultra" });
});

test("session_start: resets to off when no caveman-mode entry exists", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx } = makeFakeCtx([
		{ type: "message", customType: undefined, data: {} },
	]);
	const handler = fake.events.get("session_start");
	handler({}, ctx);
	const beforeStart = fake.events.get("before_agent_start");
	assert.equal(beforeStart({ systemPrompt: "SYS" }), undefined);
});

test("/caveman: persists a valid mode and appends a session entry", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx, notifications } = makeFakeCtx();
	const caveman = fake.commands.get("caveman");
	caveman.handler("wenyan", ctx);

	assert.equal(fake.appended.length, 1);
	assert.equal(fake.appended[0].customType, "caveman-mode");
	assert.equal(fake.appended[0].data.mode, "wenyan-full");
	assert.equal(notifications.at(-1).level, "info");
});

test("/caveman: notifies an error on an invalid mode and persists nothing", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx, notifications } = makeFakeCtx();
	const caveman = fake.commands.get("caveman");
	caveman.handler("banana", ctx);

	assert.equal(fake.appended.length, 0, "invalid mode must not persist");
	assert.equal(notifications.at(-1).level, "error");
	assert.match(notifications.at(-1).message, /banana/);
});

test("/caveman-compress: notifies an error when called with an empty arg", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx, notifications } = makeFakeCtx();
	const compress = fake.commands.get("caveman-compress");
	compress.handler("", ctx);

	assert.equal(notifications.at(-1).level, "error");
	assert.match(notifications.at(-1).message, /Usage: \/caveman-compress/);
	assert.equal(fake.userMessages.length, 0, "must not dispatch a skill message");
});

test("/caveman-compress: dispatches the skill message for a valid target", () => {
	const fake = makeFakePi();
	cavemanExtension(fake.pi);
	const { ctx } = makeFakeCtx();
	const compress = fake.commands.get("caveman-compress");
	compress.handler("docs/notes.md", ctx);
	assert.equal(fake.userMessages.length, 1);
	assert.match(fake.userMessages[0], /caveman-compress docs\/notes\.md/);
});

// --- type-only SDK import invariant ---

test("SDK import in caveman.ts is type-only (erasable by strip-types)", () => {
	const src = readFileSync(join(repoRoot, "extensions/caveman.ts"), "utf8");
	assert.match(
		src,
		/import\s+type\s+\{[^}]*\}\s+from\s+["']@earendil-works\/pi-coding-agent["']/,
		"caveman.ts must import the SDK as `import type` only",
	);
	// no value import from the SDK
	assert.doesNotMatch(
		src,
		/import\s+(?!type\b)[^;]*from\s+["']@earendil-works\/pi-coding-agent["']/,
		"caveman.ts must not add a value import from the SDK",
	);
});

test("SDK import in caveman-core.ts (if any) is type-only", () => {
	const src = readFileSync(join(repoRoot, "extensions/caveman-core.ts"), "utf8");
	const importsSdk = /@earendil-works\/pi-coding-agent/.test(src);
	if (importsSdk) {
		assert.doesNotMatch(
			src,
			/import\s+(?!type\b)[^;]*from\s+["']@earendil-works\/pi-coding-agent["']/,
			"caveman-core.ts must not add a value import from the SDK",
		);
	} else {
		assert.ok(true, "caveman-core.ts does not import the SDK");
	}
});
