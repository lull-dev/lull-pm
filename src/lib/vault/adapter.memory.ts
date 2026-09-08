/**
 * An in-memory vault.
 *
 * Used by the tests, and by `npm run dev` in a plain browser where there is no Tauri runtime to
 * talk to. It is deliberately strict about the same things the real adapter is strict about, so a
 * bug that would corrupt a note shows up here first.
 */

import {
	assertSafePath,
	assertWritablePath,
	noteFolder,
	noteName,
	type ListOptions,
	type VaultAdapter,
	type VaultChange,
	type VaultFile
} from './adapter';

interface Entry {
	content: string;
	mtimeMs: number;
}

export class MemoryVaultAdapter implements VaultAdapter {
	readonly root = 'memory://vault';
	readonly name: string;

	private files = new Map<string, Entry>();
	private listeners = new Set<(changes: VaultChange[]) => void>();
	private clock = 1_000;

	constructor(files: Record<string, string> = {}, name = 'Memory Vault') {
		this.name = name;
		for (const [path, content] of Object.entries(files)) {
			assertSafePath(path);
			this.files.set(path, { content, mtimeMs: this.tick() });
		}
	}

	/** Advance a synthetic clock, so mtime comparisons are deterministic in tests. */
	private tick(): number {
		return ++this.clock;
	}

	async read(path: string): Promise<string> {
		assertSafePath(path);
		const entry = this.files.get(path);
		if (!entry) throw new Error(`No such note: ${path}`);
		return entry.content;
	}

	async write(path: string, content: string): Promise<void> {
		assertWritablePath(path);
		const existed = this.files.has(path);
		this.files.set(path, { content, mtimeMs: this.tick() });
		this.emit([{ kind: existed ? 'modified' : 'created', path }]);
	}

	async exists(path: string): Promise<boolean> {
		assertSafePath(path);
		return this.files.has(path);
	}

	async stat(path: string) {
		assertSafePath(path);
		const entry = this.files.get(path);
		if (!entry) return null;
		return { mtimeMs: entry.mtimeMs, size: entry.content.length };
	}

	async list(folder: string, options?: ListOptions): Promise<VaultFile[]> {
		const prefix = folder === '' ? '' : `${folder.replace(/\/$/, '')}/`;
		const extensions = options?.extensions ?? ['.md'];
		const out: VaultFile[] = [];

		for (const [path, entry] of this.files) {
			if (!extensions.some((ext) => path.toLowerCase().endsWith(ext))) continue;
			if (!path.startsWith(prefix)) continue;
			const rest = path.slice(prefix.length);
			if (!options?.recursive && rest.includes('/')) continue;
			if (rest.split('/').some((segment) => segment.startsWith('.'))) continue;

			out.push({
				path,
				name: noteName(path),
				folder: noteFolder(path),
				mtimeMs: entry.mtimeMs,
				size: entry.content.length
			});
		}

		return out.sort((a, b) => a.path.localeCompare(b.path));
	}

	async mkdir(): Promise<void> {
		// Folders are implied by paths here; nothing to do.
	}

	async watch(onChange: (changes: VaultChange[]) => void): Promise<() => void> {
		this.listeners.add(onChange);
		return () => this.listeners.delete(onChange);
	}

	/** Simulate someone editing a note in Obsidian while lull has it open. */
	touch(path: string, content: string): void {
		this.files.set(path, { content, mtimeMs: this.tick() });
		this.emit([{ kind: 'modified', path }]);
	}

	private emit(changes: VaultChange[]): void {
		for (const listener of this.listeners) listener(changes);
	}
}
