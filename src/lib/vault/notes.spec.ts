import { describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from './adapter.memory';
import {
	childrenOf,
	indexVault,
	isMainNote,
	mainNoteFor,
	mainNotesByFolder,
	stripBang,
	type IndexedNote
} from './notes';

const project = (org = 'Ferret Media') =>
	`---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[${org}]]"\nstatus:\n  - Idea\n---\n`;
const task = '---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\n---\n';
const company = '---\ncategories:\n  - "[[Categories/Companies|Companies]]"\n---\n';

/** The folders a category lives in. Never an entity's own folder. */
const ROOTS = ['Projects', 'Companies', 'Goals', 'Tasks'];

/**
 * The folder layout of the real vault, in miniature: projects grouped by company under `Projects/`,
 * a project that lives under `Companies/` instead, `!`-marked main notes, and a company main note
 * that neither carries a bang nor matches its folder.
 */
function vault() {
	return new MemoryVaultAdapter({
		'Projects/Short - Lighting is everything.md': project(),
		'Projects/Ferret Media/Iron Forge Gym.md': project(),
		'Projects/Ferret Media/WOW Meta.md': project(),
		'Projects/Dark Vibrance/!Dark Vibrance.md': project(),
		'Projects/Dark Vibrance/Moodboard.md': project(),
		'Companies/lull-Software/lull.app/!lull.app.md': project('lull'),
		'Companies/lull-Software/lull.md': company,
		'Companies/Ferret Media (Zelfstandig)/Ferret Media.md': company,
		'Companies/Ferret Media (Zelfstandig)/Pricing - Ferret Media.md': company,
		'Companies/TrueFerret/TrueFerret.md': company,
		'Companies/!Fig Sphinx.md': company,
		'Tasks/Design the new ASE button.md': task,
		'Templates/Project Template.md': project(),
		'Notes/Some stray thought.md': '# Just a note\n'
	});
}

describe('indexVault', () => {
	it('finds notes by category regardless of which folder they sit in', async () => {
		const index = await indexVault(vault());
		const paths = index.byCategory('Projects').map((n) => n.path);

		// The project under Companies/ is the point: a folder scan of Projects/ would miss it.
		expect(paths).toContain('Companies/lull-Software/lull.app/!lull.app.md');
		expect(paths).toContain('Projects/Ferret Media/Iron Forge Gym.md');
		expect(paths).toHaveLength(6);
	});

	it('matches an aliased category link', async () => {
		const index = await indexVault(vault());
		expect(index.byCategory('Companies')).toHaveLength(5);
	});

	it('excludes templates, the rule every .base already applies', async () => {
		const index = await indexVault(vault());
		expect(index.all.map((n) => n.path)).not.toContain('Templates/Project Template.md');
	});

	it('reports uncategorised notes instead of guessing from their folder', async () => {
		const index = await indexVault(vault());
		expect(index.uncategorised.map((n) => n.path)).toEqual(['Notes/Some stray thought.md']);
	});

	it('strips the sorting bang from a note title but not from its name', async () => {
		const index = await indexVault(vault());
		const main = index.byPath('Projects/Dark Vibrance/!Dark Vibrance.md')!;
		expect(main.name).toBe('!Dark Vibrance');
		expect(main.title).toBe('Dark Vibrance');
	});

	it('returns nothing for a category no note claims', async () => {
		const index = await indexVault(vault());
		expect(index.byCategory('Goals')).toEqual([]);
	});
});

describe('isMainNote', () => {
	it('recognises a bang-prefixed note', async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const main = projects.find((n) => n.name === '!Dark Vibrance')!;
		expect(isMainNote(main, projects)).toBe(true);
	});

	it('recognises a note named after its folder', async () => {
		const companies = (await indexVault(vault())).byCategory('Companies');
		const main = companies.find((n) => n.path === 'Companies/TrueFerret/TrueFerret.md')!;
		expect(isMainNote(main, companies)).toBe(true);
	});

	it('recognises the only candidate in a folder', async () => {
		const companies = (await indexVault(vault())).byCategory('Companies');
		const main = companies.find((n) => n.path === 'Companies/lull-Software/lull.md')!;
		expect(isMainNote(main, companies)).toBe(true);
	});

	it('recognises a folder that is the title plus a legal-form qualifier', async () => {
		const companies = (await indexVault(vault())).byCategory('Companies');
		const main = companies.find(
			(n) => n.path === 'Companies/Ferret Media (Zelfstandig)/Ferret Media.md'
		)!;
		expect(isMainNote(main, companies)).toBe(true);
	});

	it('does not promote a sibling that is merely one of several', async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const sibling = projects.find((n) => n.path === 'Projects/Ferret Media/Iron Forge Gym.md')!;
		expect(isMainNote(sibling, projects)).toBe(false);
	});

	it('never treats a note at the vault root as a main note', async () => {
		const index = await indexVault(new MemoryVaultAdapter({ 'Dashboard.md': company }));
		const notes = index.byCategory('Companies');
		expect(isMainNote(notes[0], notes)).toBe(false);
	});
});

describe('mainNotesByFolder', () => {
	it('prefers the bang when a folder has two candidates', () => {
		const note = (path: string): IndexedNote => ({
			path,
			name: path.slice(path.lastIndexOf('/') + 1, -3),
			title: stripBang(path.slice(path.lastIndexOf('/') + 1, -3)),
			folder: path.slice(0, path.lastIndexOf('/')),
			categories: ['Projects'],
			note: { hasFrontmatter: false } as IndexedNote['note']
		});

		const candidates = [note('Projects/Linker/Linker.md'), note('Projects/Linker/!Linker.md')];
		expect(mainNotesByFolder(candidates, ROOTS).get('Projects/Linker')?.name).toBe('!Linker');
	});
});

describe('mainNoteFor', () => {
	it('attaches a sub-note to its folder main note', async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const mains = mainNotesByFolder(projects, ROOTS);
		const child = projects.find((n) => n.path === 'Projects/Dark Vibrance/Moodboard.md')!;

		expect(mainNoteFor(child, mains)?.name).toBe('!Dark Vibrance');
	});

	it('leaves a main note parentless rather than attaching it to itself', async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const mains = mainNotesByFolder(projects, ROOTS);
		const main = projects.find((n) => n.name === '!Dark Vibrance')!;

		expect(mainNoteFor(main, mains)).toBeUndefined();
	});

	it('leaves a flat project alone — no folder, no parent', async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const mains = mainNotesByFolder(projects, ROOTS);
		const flat = projects.find((n) => n.name === 'Short - Lighting is everything')!;

		expect(mainNoteFor(flat, mains)).toBeUndefined();
	});

	it('stops at the nearest main note rather than the outermost one', async () => {
		const index = await indexVault(
			new MemoryVaultAdapter({
				'Companies/Ferret Media/!Ferret Media.md': company,
				'Companies/Ferret Media/Products/!Products.md': company,
				'Companies/Ferret Media/Products/Pricing.md': company
			})
		);
		const companies = index.byCategory('Companies');
		const mains = mainNotesByFolder(companies, ROOTS);
		const deep = companies.find((n) => n.name === 'Pricing')!;

		expect(mainNoteFor(deep, mains)?.name).toBe('!Products');
	});
});

describe('childrenOf', () => {
	it("returns a main note's sub-notes, excluding itself", async () => {
		const projects = (await indexVault(vault())).byCategory('Projects');
		const mains = mainNotesByFolder(projects, ROOTS);
		const main = projects.find((n) => n.name === '!Dark Vibrance')!;

		expect(childrenOf(main, projects, mains).map((n) => n.name)).toEqual(['Moodboard']);
	});
});

describe('category root folders', () => {
	it('does not let a bang note at a category root adopt the whole category', async () => {
		// Companies/!Fig Sphinx.md is a company, not a container for every other company.
		const companies = (await indexVault(vault())).byCategory('Companies');
		const mains = mainNotesByFolder(companies, ROOTS);
		const other = companies.find((n) => n.path === 'Companies/TrueFerret/TrueFerret.md')!;

		expect(mains.has('Companies')).toBe(false);
		expect(mainNoteFor(other, mains)).toBeUndefined();
	});

	it('attaches a company sub-note to the main note of its qualified folder', async () => {
		const companies = (await indexVault(vault())).byCategory('Companies');
		const mains = mainNotesByFolder(companies, ROOTS);
		const child = companies.find((n) => n.name === 'Pricing - Ferret Media')!;

		expect(mainNoteFor(child, mains)?.name).toBe('Ferret Media');
	});
});
