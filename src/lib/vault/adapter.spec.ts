import { describe, expect, it } from 'vitest';
import {
	ConcurrentEditError,
	assertSafePath,
	assertWritablePath,
	createNote,
	editNote,
	joinPath,
	noteFolder,
	noteName,
	obsidianUri
} from './adapter';
import { MemoryVaultAdapter } from './adapter.memory';
import { getBoolean, parseNote, setFrontmatterValue } from './frontmatter';

const DAILY = `---
categories:
  - "[[Daily Notes]]"
Make Bed: false
Shower: false
created: 2026-06-09
---

## Quick ToDo:
-  [ ]
`;

function vault() {
	return new MemoryVaultAdapter(
		{
			'Daily Notes/2026-06-09.md': DAILY,
			'Tasks/Create CP Migration Plan.md': '---\nstatus: Todo\n---\n\n## Why\n',
			'.obsidian/app.json': '{}'
		},
		'TrueFerret-Vault'
	);
}

describe('paths', () => {
	it('derives name and folder the way wikilinks resolve', () => {
		expect(noteName('Tasks/Create CP Migration Plan.md')).toBe('Create CP Migration Plan');
		expect(noteFolder('Tasks/Create CP Migration Plan.md')).toBe('Tasks');
		expect(noteFolder('Dashboard.md')).toBe('');
	});

	it('joins without doubling or leading slashes', () => {
		expect(joinPath('Daily Notes', '2026-06-09.md')).toBe('Daily Notes/2026-06-09.md');
		expect(joinPath('', 'Dashboard.md')).toBe('Dashboard.md');
	});

	it('rejects paths that escape the vault', () => {
		expect(() => assertSafePath('../secrets.md')).toThrow(/escape the vault/);
		expect(() => assertSafePath('Tasks/../../etc/passwd')).toThrow(/escape the vault/);
		expect(() => assertSafePath('/etc/passwd')).toThrow(/must be relative/);
	});

	it("allows reading Obsidian's config but refuses to write there", () => {
		// lull reads .obsidian/daily-notes.json to find the daily note folder and template.
		expect(() => assertSafePath('.obsidian/daily-notes.json')).not.toThrow();
		expect(() => assertWritablePath('.obsidian/daily-notes.json')).toThrow(/not lull's to change/);
		expect(() => assertWritablePath('.git/config')).toThrow(/not lull's to change/);
	});
});

describe('list', () => {
	it('returns markdown notes in a folder', async () => {
		expect((await vault().list('Daily Notes')).map((f) => f.name)).toEqual(['2026-06-09']);
	});

	it('skips dot-folders even when scanning the whole vault', async () => {
		const paths = (await vault().list('', { recursive: true })).map((f) => f.path);
		expect(paths).not.toContain('.obsidian/app.json');
		expect(paths).toContain('Tasks/Create CP Migration Plan.md');
	});

	it('is non-recursive by default', async () => {
		expect(await vault().list('')).toEqual([]);
	});
});

describe('editNote', () => {
	it('applies a surgical edit and writes it back', async () => {
		const adapter = vault();
		const path = 'Daily Notes/2026-06-09.md';

		await editNote(adapter, path, (raw) => setFrontmatterValue(raw, 'Make Bed', true));

		const after = parseNote(await adapter.read(path));
		expect(getBoolean(after, 'Make Bed')).toBe(true);
		expect(getBoolean(after, 'Shower')).toBe(false);
		expect(after.body).toBe(parseNote(DAILY).body);
	});

	it('does not write at all when the edit changes nothing', async () => {
		const adapter = vault();
		const path = 'Daily Notes/2026-06-09.md';
		const before = await adapter.stat(path);

		await editNote(adapter, path, (raw) => setFrontmatterValue(raw, 'Make Bed', false));

		expect(await adapter.stat(path)).toEqual(before);
	});

	it('keeps a concurrent edit from Obsidian instead of clobbering it', async () => {
		const adapter = vault();
		const path = 'Daily Notes/2026-06-09.md';
		let firstPass = true;

		// lull ticks "Make Bed" while, mid-edit, Obsidian saves a tick of "Shower".
		await editNote(adapter, path, (raw) => {
			if (firstPass) {
				firstPass = false;
				adapter.touch(path, setFrontmatterValue(raw, 'Shower', true));
			}
			return setFrontmatterValue(raw, 'Make Bed', true);
		});

		const after = parseNote(await adapter.read(path));
		expect(getBoolean(after, 'Make Bed')).toBe(true);
		// Both writers win, because the retry re-applies our field to their text.
		expect(getBoolean(after, 'Shower')).toBe(true);
	});

	it('gives up rather than fighting a file that will not settle', async () => {
		const adapter = vault();
		const path = 'Daily Notes/2026-06-09.md';

		await expect(
			editNote(adapter, path, (raw) => {
				adapter.touch(path, `${raw}\nsomeone else is typing\n`);
				return setFrontmatterValue(raw, 'Make Bed', true);
			})
		).rejects.toThrow(ConcurrentEditError);
	});

	it('refuses a path outside the vault', async () => {
		await expect(editNote(vault(), '../evil.md', (raw) => raw)).rejects.toThrow(/escape the vault/);
	});
});

describe('createNote', () => {
	it('creates the note and its folder', async () => {
		const adapter = vault();
		await createNote(adapter, 'Goals/Ship lull.md', '---\nstatus: Active\n---\n');
		expect(await adapter.read('Goals/Ship lull.md')).toContain('status: Active');
	});

	it('never overwrites an existing note', async () => {
		const adapter = vault();
		await expect(createNote(adapter, 'Daily Notes/2026-06-09.md', 'replacement')).rejects.toThrow(
			/already exists/
		);
		expect(await adapter.read('Daily Notes/2026-06-09.md')).toBe(DAILY);
	});
});

describe('obsidianUri', () => {
	it('builds a link that opens the note in Obsidian', () => {
		expect(obsidianUri(vault(), 'Tasks/Create CP Migration Plan.md')).toBe(
			'obsidian://open?vault=TrueFerret-Vault&file=Tasks%2FCreate%20CP%20Migration%20Plan'
		);
	});
});
