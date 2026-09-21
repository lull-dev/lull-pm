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
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryNames } from './categories';
import { parentViolation, parentsOn, setParent, type ParentedType } from '$lib/models/Parent';
import {
	getBoolean,
	getString,
	getStringList,
	keys,
	parseNote,
	setFrontmatterValue,
	type FrontmatterValue
} from './frontmatter';
import { mainNoteFor, mainNotesByFolder, stripBang, type IndexedNote } from './notes';

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

	/**
	 * A census, not an assertion.
	 *
	 * Phase 0 moved lull-pm from "a project is a file in `Projects/`" to "a project is a note that
	 * says `categories: [[Projects]]`". This prints what that rule actually finds in the real vault,
	 * so the change can be checked against the vault rather than against a fixture — including the
	 * notes it finds *nothing* for, like `!lull.app.md`, which has no frontmatter at all.
	 */
	it('reports what each category finds, and what it misses', async () => {
		const notes = await readAll(vaultRoot!);
		const indexed: IndexedNote[] = notes
			.filter(({ path }) => !path.toLowerCase().includes('template'))
			.map(({ path, raw }) => {
				const vaultPath = path.split(sep).join('/');
				const slash = vaultPath.lastIndexOf('/');
				const name = vaultPath.slice(slash + 1).replace(/\.md$/i, '');
				const note = parseNote(raw);
				return {
					path: vaultPath,
					name,
					title: stripBang(name),
					folder: slash === -1 ? '' : vaultPath.slice(0, slash),
					categories: categoryNames(note),
					note
				};
			});

		const counts = new Map<string, number>();
		for (const note of indexed) {
			for (const category of note.categories) {
				counts.set(category, (counts.get(category) ?? 0) + 1);
			}
		}

		const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
		const uncategorised = indexed.filter((note) => note.categories.length === 0);

		const roots = ['Projects', 'Companies', 'Goals', 'Tasks', 'Categories/Buckets'];
		const lines: string[] = [];
		for (const category of ['Projects', 'Companies', 'Tasks', 'Goals', 'Buckets']) {
			const members = indexed.filter((note) =>
				note.categories.some((c) => c.toLowerCase() === category.toLowerCase())
			);
			// Mains are drawn from the category; children are drawn from *every* note, because a
			// project's sub-notes are ordinary notes — they carry no `categories: [[Projects]]` of
			// their own, and counting only category members would report zero of them.
			const mains = mainNotesByFolder(members, roots);
			const children = indexed.filter((note) => mainNoteFor(note, mains) !== undefined);
			lines.push(
				`  ${category}: ${members.length} note(s), ` +
					`${mains.size} with their own folder, ${children.length} sub-note(s)`
			);
		}

		console.warn(
			`\n${indexed.length} notes, ${ranked.length} categories.\n` +
				`Top categories: ${ranked
					.slice(0, 8)
					.map(([name, n]) => `${name} (${n})`)
					.join(', ')}\n` +
				`lull-pm's types:\n${lines.join('\n')}\n` +
				`${uncategorised.length} note(s) carry no category and are left alone.\n`
		);

		// The census is informational; what must hold is that reading never invented a category.
		expect(indexed.every((note) => note.categories.every((c) => c.trim() !== ''))).toBe(true);
	});

	/**
	 * The rule, checked against every note that has one: a project connects to a company or a
	 * bucket, a task to a project or a bucket. Never both, never two.
	 *
	 * Read-only. Violations are reported, not repaired — a note connected to two things is a
	 * decision only the user can make, and guessing which link to drop is exactly the kind of quiet
	 * data loss the rest of this file exists to prevent.
	 */
	it('reports notes whose connections break the one-parent rule', async () => {
		const types: { category: string; type: ParentedType }[] = [
			{ category: 'Projects', type: 'project' },
			{ category: 'Tasks', type: 'task' },
			{ category: 'Goals', type: 'goal' }
		];

		const violations: string[] = [];
		let checked = 0;

		for (const { path, raw } of await readAll(vaultRoot!)) {
			if (path.toLowerCase().includes('template')) continue;
			const note = parseNote(raw);
			const categories = categoryNames(note).map((c) => c.toLowerCase());

			for (const { category, type } of types) {
				if (!categories.includes(category.toLowerCase())) continue;
				checked++;

				const violation = parentViolation(note, type);
				if (violation) {
					const links = parentsOn(note, type)
						.map((parent) => `${parent.kind}:${parent.name}`)
						.join(' + ');
					violations.push(`${path} — ${violation} (${links})`);
				}
			}
		}

		if (violations.length > 0) {
			console.warn(
				`\n${violations.length} of ${checked} note(s) are connected to more than one thing.\n` +
					`lull-pm shows the most specific and flags the rest; nothing is rewritten:\n  ` +
					`${violations.join('\n  ')}\n`
			);
		}

		expect(checked).toBeGreaterThan(0);
	});

	/**
	 * Setting a note's parent to the parent it already has must not move a byte — the same
	 * guarantee the property test above makes, for the one write that touches two keys at once.
	 */
	it('changes nothing when a note is reconnected to the parent it already has', async () => {
		const moved: string[] = [];
		let checked = 0;

		for (const { path, raw } of await readAll(vaultRoot!)) {
			if (path.toLowerCase().includes('template')) continue;
			const note = parseNote(raw);
			if (!note.hasFrontmatter || note.errors.length > 0) continue;

			const categories = categoryNames(note).map((c) => c.toLowerCase());
			const type: ParentedType | null = categories.includes('projects')
				? 'project'
				: categories.includes('tasks')
					? 'task'
					: null;
			if (!type) continue;

			// A note that already breaks the rule has no single parent to rewrite; it is reported
			// by the test above instead.
			if (parentViolation(note, type)) continue;

			const [parent] = parentsOn(note, type);
			checked++;
			if (setParent(raw, type, parent ?? null) !== raw) moved.push(`${path} [${type}]`);
		}

		expect(checked).toBeGreaterThan(0);
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
