/**
 * Read-only audit of a real vault.
 *
 * The other specs prove the markdown core behaves on fixtures. This proves it behaves on *your*
 * notes — every one of them — before lull is ever pointed at the real thing.
 *
 *     LULL_VAULT=~/TrueFerret-Vault npm test
 *
 * Skipped entirely when `LULL_VAULT` is unset, so it never blocks an ordinary test run. It opens
 * every markdown file and never writes anything.
 *
 * The property that matters most is the second one below: writing a property back at the value it
 * already has must be a no-op, byte for byte. If setting `status` to what `status` already says
 * moves so much as a space, then every real write lull makes to that note would carry that damage
 * with it.
 */

import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	getBoolean,
	getString,
	getStringList,
	keys,
	parseNote,
	setFrontmatterValue,
	type FrontmatterValue
} from './frontmatter';

const IGNORED = new Set(['.obsidian', '.git', '.trash', '.lull', 'node_modules', '.stfolder']);

const configured = process.env.LULL_VAULT;
const vaultRoot = configured?.startsWith('~') ? join(homedir(), configured.slice(1)) : configured;

async function* walk(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) yield full;
	}
}

interface Note {
	path: string;
	raw: string;
}

async function readAll(root: string): Promise<Note[]> {
	const notes: Note[] = [];
	for await (const file of walk(root)) {
		notes.push({ path: relative(root, file), raw: await readFile(file, 'utf8') });
	}
	return notes;
}

/** The value a property currently holds, in a form we can write back exactly. */
function representableValue(
	note: ReturnType<typeof parseNote>,
	key: string
): FrontmatterValue | undefined {
	const bool = getBoolean(note, key);
	if (bool !== undefined) return bool;

	const list = getStringList(note, key);
	if (list.length > 1) return list;

	const text = getString(note, key);
	return text;
}

describe.skipIf(!vaultRoot)(`real vault at ${vaultRoot}`, () => {
	it('splits and reassembles every note losslessly', async () => {
		const broken: string[] = [];

		for (const { path, raw } of await readAll(vaultRoot!)) {
			const note = parseNote(raw);
			const rebuilt = note.raw.slice(0, note.yamlStart) + note.yaml + note.raw.slice(note.yamlEnd);
			if (rebuilt !== raw) broken.push(path);
		}

		expect(broken).toEqual([]);
	});

	it('changes nothing when a property is rewritten at the value it already holds', async () => {
		const moved: string[] = [];
		const refused: string[] = [];
		let propertiesChecked = 0;

		for (const { path, raw } of await readAll(vaultRoot!)) {
			const note = parseNote(raw);
			if (!note.hasFrontmatter || note.errors.length > 0) continue;

			for (const key of keys(note)) {
				const value = representableValue(note, key);
				if (value === undefined) continue;
				propertiesChecked++;

				try {
					if (setFrontmatterValue(raw, key, value) !== raw) moved.push(`${path} [${key}]`);
				} catch (error) {
					refused.push(`${path} [${key}] — ${(error as Error).message}`);
				}
			}
		}

		expect(propertiesChecked).toBeGreaterThan(0);
		expect(refused).toEqual([]);
		expect(moved).toEqual([]);
	});

	it('reports notes whose frontmatter does not parse, which lull refuses to write', async () => {
		const damaged: string[] = [];

		for (const { path, raw } of await readAll(vaultRoot!)) {
			const note = parseNote(raw);
			if (note.hasFrontmatter && note.errors.length > 0) {
				damaged.push(`${path} — ${note.errors[0]}`);
			}
		}

		// Not a failure: refusing to write these is the correct behaviour. Logged so they can be
		// fixed in Obsidian, since lull will decline to touch them until they are.
		if (damaged.length > 0) {
			console.warn(
				`\n${damaged.length} note(s) have frontmatter that does not parse cleanly.\n` +
					`lull will read them but refuse to write them:\n  ${damaged.join('\n  ')}\n`
			);
		}
		expect(Array.isArray(damaged)).toBe(true);
	});
});
