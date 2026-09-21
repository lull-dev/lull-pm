/**
 * One pass over the vault, bucketed by category.
 *
 * `categories.ts` explains why type comes from `categories:` rather than from a folder. The cost of
 * that is a full-vault walk instead of a cheap `list('Tasks')` — a project can live under
 * `Companies/lull-Software/lull.app/`, so there is no folder to shortcut through. That walk happens
 * **once** and serves every type, rather than once per service: four separate walks over 1300 notes
 * to find four categories would read the same bytes four times.
 *
 * Templates are excluded by name, matching the rule every `.base` in the vault already applies
 * (`!file.name.contains("Template")`).
 */

import { noteFolder, noteName, type VaultAdapter } from './adapter';
import { categoryNames } from './categories';
import { parseNote, type ParsedNote } from './frontmatter';

export interface IndexedNote {
	/** Vault-relative path. A note's identity. */
	path: string;
	/** Basename without `.md` — what wikilinks resolve against, `!` and all. */
	name: string;
	/**
	 * `name` with a leading `!` stripped.
	 *
	 * The vault marks a folder's main note with a bang — `Projects/Dark Vibrance/!Dark Vibrance.md`
	 * — so the note sorts to the top of the folder in Obsidian's file list. That bang is a sorting
	 * device, not part of the title, and nothing but the file list should show it.
	 */
	title: string;
	/** Containing folder, vault-relative. Empty string for the vault root. */
	folder: string;
	categories: string[];
	note: ParsedNote;
}

export interface VaultIndex {
	/** Every markdown note in the vault, templates excluded. */
	all: IndexedNote[];
	/** Notes claiming a category, by basename, case-insensitively. */
	byCategory(category: string): IndexedNote[];
	byPath(path: string): IndexedNote | undefined;
	/**
	 * Notes with no `categories:` at all.
	 *
	 * Not an error, and not something to guess about: `Companies/lull-Software/lull.app/!lull.app.md`
	 * is plainly a project but says so nowhere, and inventing a category for it from its folder is
	 * exactly the kind of guess this module exists to avoid. Surfaced so it can be fixed in Obsidian.
	 */
	uncategorised: IndexedNote[];
}

/** Read and categorise every note in the vault. */
export async function indexVault(adapter: VaultAdapter): Promise<VaultIndex> {
	const files = await adapter.list('', { recursive: true });

	const all = await Promise.all(
		files
			.filter((file) => !file.name.toLowerCase().includes('template'))
			.map(async (file): Promise<IndexedNote> => {
				const note = parseNote(await adapter.read(file.path));
				return {
					path: file.path,
					name: file.name,
					title: stripBang(file.name),
					folder: file.folder,
					categories: categoryNames(note),
					note
				};
			})
	);

	const byName = new Map<string, IndexedNote[]>();
	for (const note of all) {
		for (const category of note.categories) {
			const key = category.toLowerCase();
			const bucket = byName.get(key);
			if (bucket) bucket.push(note);
			else byName.set(key, [note]);
		}
	}

	const byPath = new Map(all.map((note) => [note.path, note]));

	return {
		all,
		byCategory: (category) => byName.get(category.toLowerCase()) ?? [],
		byPath: (path) => byPath.get(path),
		uncategorised: all.filter((note) => note.categories.length === 0)
	};
}

/* -------------------------------------------------------------------------- */
/* Main notes and their children                                               */
/* -------------------------------------------------------------------------- */

/**
 * How strongly this note claims to be the one its folder is *about*, or 0 for not at all.
 *
 * Four signals, strongest first, in the order the vault itself uses them:
 *
 * - **3** — a leading `!`, the explicit marker, and the only one applied deliberately
 *   (`!Dark Vibrance.md`, `!lull.app.md`, `!Migration MAKROLON Covestro.md`).
 * - **2** — a title matching its folder, `Companies/TrueFerret/TrueFerret.md`.
 * - **2** — a folder that is the title plus a qualifier:
 *   `Companies/Ferret Media (Zelfstandig)/Ferret Media.md`, `Student Events (VZW)/Student
 *   Events.md`. The vault suffixes company folders with a legal form the note itself does not
 *   carry, and without this those two folders would have no main note at all.
 * - **1** — being the only candidate in the folder, which leaves nothing else it could be.
 *
 * A score rather than a boolean because a folder can have two candidates — `Linker/Linker.md`
 * beside `Linker/!Linker.md` — and the deliberate marker should win over a name that could be
 * coincidence.
 */
export function mainNoteScore(note: IndexedNote, candidates: IndexedNote[]): number {
	if (note.folder === '') return 0;
	if (note.name.startsWith('!')) return 3;

	const folderName = note.folder.slice(note.folder.lastIndexOf('/') + 1).toLowerCase();
	const title = note.title.toLowerCase();
	if (folderName === title) return 2;
	if (folderName.startsWith(`${title} `)) return 2;

	const siblings = candidates.filter((other) => other.folder === note.folder);
	return siblings.length === 1 && siblings[0].path === note.path ? 1 : 0;
}

/** Whether this note is the one its folder is about. See `mainNoteScore`. */
export function isMainNote(note: IndexedNote, candidates: IndexedNote[]): boolean {
	return mainNoteScore(note, candidates) > 0;
}

/**
 * The main note of each folder that has one, keyed by folder.
 *
 * `rootFolders` are the folders a category *lives* in — `Projects`, `Companies`, `Goals` — and can
 * never be an entity's own folder. Without that, `Companies/!Fig Sphinx.md` would claim all of
 * `Companies/` on the strength of its bang and adopt every company that has no main note of its
 * own. A bang means "I am what this folder is about" only when the folder is about one thing.
 */
export function mainNotesByFolder(
	candidates: IndexedNote[],
	rootFolders: string[] = []
): Map<string, IndexedNote> {
	const roots = new Set(rootFolders.map((folder) => folder.replace(/\/$/, '')));
	const mains = new Map<string, IndexedNote>();
	const scores = new Map<string, number>();

	for (const note of candidates) {
		if (note.folder === '' || roots.has(note.folder)) continue;

		const score = mainNoteScore(note, candidates);
		if (score === 0) continue;

		if (score > (scores.get(note.folder) ?? 0)) {
			mains.set(note.folder, note);
			scores.set(note.folder, score);
		}
	}

	return mains;
}

/**
 * The main note a given note belongs under, or undefined when it stands alone.
 *
 * Resolved by walking up from the note's own folder and stopping at the first folder that has a
 * main note, so a nested main note claims its own subtree:
 * `Companies/Ferret Media (Zelfstandig)/Products/!Products - Ferret Media.md` owns everything under
 * `Products/` without `Ferret Media.md` reaching past it.
 */
export function mainNoteFor(
	note: IndexedNote,
	mains: Map<string, IndexedNote>
): IndexedNote | undefined {
	let folder: string | null = note.folder;

	while (folder !== null) {
		const main = mains.get(folder);
		if (main) return main.path === note.path ? undefined : main;

		const slash: number = folder.lastIndexOf('/');
		folder = slash === -1 ? null : folder.slice(0, slash);
	}

	return undefined;
}

/** Notes that sit under `main`, nearest-main-wins. Excludes `main` itself. */
export function childrenOf(
	main: IndexedNote,
	notes: IndexedNote[],
	mains: Map<string, IndexedNote>
): IndexedNote[] {
	return notes.filter((note) => mainNoteFor(note, mains)?.path === main.path);
}

/* -------------------------------------------------------------------------- */

/** `!Dark Vibrance` → `Dark Vibrance`. See `IndexedNote.title`. */
export function stripBang(name: string): string {
	return name.startsWith('!') ? name.slice(1) : name;
}

/** The path a note would have, given a folder and a title. Re-exported for services. */
export { noteFolder, noteName };
