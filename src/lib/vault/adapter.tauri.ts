/**
 * The real vault, on disk, through Tauri.
 *
 * Paths crossing this boundary are vault-relative; everything Tauri sees is absolute. The fs
 * plugin's own scope is configured to the chosen vault folder, so this adapter is the second of two
 * independent guards rather than the only one.
 */

import {
	exists as fsExists,
	mkdir as fsMkdir,
	readDir,
	readTextFile,
	stat as fsStat,
	watch,
	writeTextFile
} from '@tauri-apps/plugin-fs';

import {
	assertSafePath,
	assertWritablePath,
	joinPath,
	noteFolder,
	noteName,
	type ListOptions,
	type VaultAdapter,
	type VaultChange,
	type VaultFile
} from './adapter';

/** Folders that are never part of the note graph. */
const IGNORED_FOLDERS = new Set(['.obsidian', '.git', '.trash', '.lull', 'node_modules']);

export class TauriVaultAdapter implements VaultAdapter {
	readonly root: string;
	readonly name: string;

	constructor(root: string, name?: string) {
		this.root = root.replace(/[/\\]+$/, '');
		this.name = name ?? this.root.slice(this.root.replace(/\\/g, '/').lastIndexOf('/') + 1);
	}

	/** Vault-relative path to an absolute one. */
	private absolute(path: string): string {
		assertSafePath(path);
		return `${this.root}/${path}`;
	}

	async read(path: string): Promise<string> {
		return readTextFile(this.absolute(path));
	}

	async write(path: string, content: string): Promise<void> {
		assertWritablePath(path);
		await writeTextFile(this.absolute(path), content);
	}

	async exists(path: string): Promise<boolean> {
		return fsExists(this.absolute(path));
	}

	async stat(path: string) {
		try {
			const info = await fsStat(this.absolute(path));
			return { mtimeMs: info.mtime?.getTime() ?? 0, size: info.size };
		} catch {
			return null;
		}
	}

	async list(folder: string, options?: ListOptions): Promise<VaultFile[]> {
		const out: VaultFile[] = [];
		await this.collect(folder, options?.recursive ?? false, options?.extensions ?? ['.md'], out);
		return out.sort((a, b) => a.path.localeCompare(b.path));
	}

	private async collect(
		folder: string,
		recursive: boolean,
		extensions: string[],
		out: VaultFile[]
	): Promise<void> {
		const absolute = folder === '' ? this.root : this.absolute(folder);

		let entries;
		try {
			entries = await readDir(absolute);
		} catch {
			// A folder the vault does not have yet is simply empty, not an error.
			return;
		}

		for (const entry of entries) {
			if (entry.name.startsWith('.') || IGNORED_FOLDERS.has(entry.name)) continue;
			const path = joinPath(folder, entry.name);

			if (entry.isDirectory) {
				if (recursive) await this.collect(path, true, extensions, out);
				continue;
			}
			if (!entry.isFile) continue;
			if (!extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) continue;

			const info = await this.stat(path);
			out.push({
				path,
				name: noteName(path),
				folder: noteFolder(path),
				mtimeMs: info?.mtimeMs ?? 0,
				size: info?.size ?? 0
			});
		}
	}

	async mkdir(folder: string): Promise<void> {
		if (folder === '') return;
		assertWritablePath(folder);
		if (await this.exists(folder)) return;
		await fsMkdir(this.absolute(folder), { recursive: true });
	}

	async watch(onChange: (changes: VaultChange[]) => void): Promise<() => void> {
		// Debounced, because Obsidian autosaves in bursts and a write is often several fs events.
		return watch(
			this.root,
			(event) => {
				const changes = event.paths
					.map((absolute) => this.relative(absolute))
					.filter((path): path is string => path !== null)
					.map((path) => ({ kind: kindOf(event.type), path }));

				if (changes.length > 0) onChange(changes);
			},
			{ recursive: true, delayMs: 300 }
		);
	}

	/** Absolute path back to vault-relative, or null when it is outside the vault or ignored. */
	private relative(absolute: string): string | null {
		const normalised = absolute.replace(/\\/g, '/');
		const root = this.root.replace(/\\/g, '/');
		if (!normalised.startsWith(`${root}/`)) return null;

		const path = normalised.slice(root.length + 1);
		if (!path.toLowerCase().endsWith('.md')) return null;
		if (path.split('/').some((segment) => segment.startsWith('.'))) return null;
		return path;
	}
}

function kindOf(type: unknown): VaultChange['kind'] {
	if (typeof type === 'object' && type !== null) {
		if ('create' in type) return 'created';
		if ('remove' in type) return 'removed';
	}
	return 'modified';
}

/** True when the app is running inside Tauri rather than a plain browser tab. */
export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
