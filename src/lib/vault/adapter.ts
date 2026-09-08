/**
 * The seam between lull and the filesystem.
 *
 * Everything above this interface deals in vault-relative paths with forward slashes, exactly the
 * way Obsidian links do (`Tasks/Create CP Migration Plan.md`). Everything below deals in real paths
 * on a real disk. Keeping that boundary sharp is what lets the whole app be tested against an
 * in-memory vault, and leaves room for a browser File System Access implementation later.
 */

export interface VaultFile {
	/** Vault-relative path with forward slashes. This is a note's identity. */
	path: string;
	/** Basename without the .md extension — what wikilinks resolve against. */
	name: string;
	/** Containing folder, vault-relative. Empty string for the vault root. */
	folder: string;
	mtimeMs: number;
	size: number;
}

export interface ListOptions {
	recursive?: boolean;
	/** Extensions to include, lowercase and dot-prefixed. Defaults to `['.md']`. */
	extensions?: string[];
}

export interface VaultChange {
	kind: 'created' | 'modified' | 'removed';
	path: string;
}

export interface VaultAdapter {
	/** Human-readable vault location, for display and for `obsidian://` links. */
	readonly root: string;
	/** The vault's name, which is what the `obsidian://open?vault=` parameter wants. */
	readonly name: string;

	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	stat(path: string): Promise<{ mtimeMs: number; size: number } | null>;
	/**
	 * Files in a folder. Non-recursive by default, and never returns dot-folders.
	 *
	 * Defaults to markdown, but takes an extension list because `.base` files are this vault's
	 * query layer and lull needs to be able to find them.
	 */
	list(folder: string, options?: ListOptions): Promise<VaultFile[]>;
	mkdir(folder: string): Promise<void>;
	/** Watch the vault for external edits. Resolves to an unsubscribe function. */
	watch(onChange: (changes: VaultChange[]) => void): Promise<() => void>;
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                       */
/* -------------------------------------------------------------------------- */

export function noteName(path: string): string {
	const base = path.slice(path.lastIndexOf('/') + 1);
	return base.replace(/\.md$/i, '');
}

export function noteFolder(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

export function joinPath(...parts: string[]): string {
	return parts
		.filter((part) => part !== '')
		.join('/')
		.replace(/\/{2,}/g, '/');
}

/**
 * Reject anything that would escape the vault.
 *
 * The adapter is scoped at the Tauri layer too, but a second check here means a bug in path
 * construction fails loudly instead of quietly reaching somewhere it should not.
 */
export function assertSafePath(path: string): void {
	if (path === '' || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
		throw new Error(`Vault paths must be relative: got "${path}"`);
	}
	if (path.split('/').some((segment) => segment === '..')) {
		throw new Error(`Vault paths must not escape the vault: got "${path}"`);
	}
}

/** Dot-folders lull may read from but must never write to. */
const READ_ONLY_FOLDERS = ['.obsidian/', '.git/', '.trash/'];

/**
 * Everything `assertSafePath` checks, plus: no writing into Obsidian's or git's own state.
 *
 * Reading `.obsidian/daily-notes.json` is how lull discovers where daily notes live and which
 * template they use, so reads there are allowed and deliberate. Writing there is never ours to do —
 * the vault's AGENTS.md is explicit that `.obsidian/` is off limits unless asked.
 */
export function assertWritablePath(path: string): void {
	assertSafePath(path);
	const folder = READ_ONLY_FOLDERS.find((prefix) => path.startsWith(prefix));
	if (folder) {
		throw new Error(`Refusing to write inside ${folder} — that is not lull's to change.`);
	}
}

/* -------------------------------------------------------------------------- */
/* Safe writes                                                                 */
/* -------------------------------------------------------------------------- */

export class ConcurrentEditError extends Error {
	constructor(public readonly path: string) {
		super(
			`"${path}" kept changing underneath us. It is probably open in Obsidian — ` +
				'try again in a moment.'
		);
		this.name = 'ConcurrentEditError';
	}
}

/**
 * Read a note, transform its text, and write it back — but only if nobody else touched it in
 * between.
 *
 * This is the single choke point every write in the app goes through. Obsidian autosaves roughly
 * every two seconds and may well have the same file open, so a naive read-then-write would silently
 * discard whatever the user just typed. Instead, the edit function is re-run against freshly read
 * text whenever the file moved, which makes the change field-level rather than file-level: two
 * writers editing different properties of the same note both win.
 *
 * The edit function must therefore be pure and safe to run more than once.
 *
 * Staleness is detected by re-reading and comparing content rather than by comparing mtime: notes
 * are small, and `mtime` is documented as unavailable on some platforms, so content is both the
 * cheaper assumption and the stronger guarantee.
 */
export async function editNote(
	adapter: VaultAdapter,
	path: string,
	edit: (raw: string) => string,
	attempts = 3
): Promise<string> {
	assertWritablePath(path);

	for (let attempt = 0; attempt < attempts; attempt++) {
		const raw = await adapter.read(path);
		const next = edit(raw);

		// A no-op edit must not touch the file. Rewriting it would bump its mtime, wake the watcher,
		// and make Obsidian reload the note for no reason.
		if (next === raw) return raw;

		// Re-read immediately before writing. If the note moved while `edit` was running, throw the
		// result away and redo the edit against the new text.
		if ((await adapter.read(path)) !== raw) continue;

		await adapter.write(path, next);
		return next;
	}

	throw new ConcurrentEditError(path);
}

/**
 * Create a note, refusing to overwrite one that already exists.
 *
 * Used for materialising a daily note from its template and for creating task notes, where
 * clobbering an existing note would be data loss.
 */
export async function createNote(
	adapter: VaultAdapter,
	path: string,
	content: string
): Promise<void> {
	assertWritablePath(path);
	if (await adapter.exists(path)) {
		throw new Error(`"${path}" already exists.`);
	}
	const folder = noteFolder(path);
	if (folder !== '') await adapter.mkdir(folder);
	await adapter.write(path, content);
}

/**
 * The `obsidian://` URI that opens a note in Obsidian.
 *
 * Every item in lull gets one of these, so the app is a lens on the vault rather than a wall
 * around it — anything lull cannot do, Obsidian is one click away.
 */
export function obsidianUri(adapter: VaultAdapter, path: string): string {
	const vault = encodeURIComponent(adapter.name);
	const file = encodeURIComponent(path.replace(/\.md$/i, ''));
	return `obsidian://open?vault=${vault}&file=${file}`;
}
