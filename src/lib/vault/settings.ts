/**
 * Where lull-pm learns how a vault is laid out.
 *
 * Two sources, deliberately separate:
 *
 * - **Obsidian's own config**, read-only. `.obsidian/app.json` already knows where new notes land,
 *   so lull-pm reads it instead of guessing.
 *
 * - **`.lull/config.json`**, ours to write. It holds only things the vault has no opinion about —
 *   which folders hold which kind of note, in case a vault names them differently than this one does.
 *   Nothing in it is data — delete the file and you lose nothing but lull-pm falling back to its
 *   defaults. It lives inside the vault so it travels with whatever sync the user already has, and in
 *   a dot-folder so Obsidian ignores it. This file is shared with lull-obsidian-app's habit config by
 *   convention (same `.lull/config.json`), but each app only reads the keys it understands.
 */

import type { VaultAdapter } from './adapter';

export const LULL_CONFIG_PATH = '.lull/config.json';

export interface ObsidianAppSettings {
	/** Where new notes are created, e.g. `_Inbox Notes`. */
	newFileFolderPath: string | null;
	attachmentFolderPath: string | null;
}

export async function readAppSettings(adapter: VaultAdapter): Promise<ObsidianAppSettings> {
	const raw = await readJson<{ newFileFolderPath?: string; attachmentFolderPath?: string }>(
		adapter,
		'.obsidian/app.json'
	);
	return {
		newFileFolderPath: raw?.newFileFolderPath ?? null,
		attachmentFolderPath: raw?.attachmentFolderPath ?? null
	};
}

/* -------------------------------------------------------------------------- */
/* Templater                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Templater already knows which template a new note in a given folder should use.
 *
 * The vault has `enable_folder_templates: true` and a `folder_templates` list mapping
 * `Projects → Templates/Project Template.md`, `Companies/.../Videos → Templates/Youtube Video
 * Template.md`, and so on. That mapping *is* the project-type system, written in the plugin the
 * user already configures templates with — so lull-pm reads it rather than keeping a second,
 * divergent list of its own.
 *
 * Read-only, like `.obsidian/app.json`. Templater's settings are Templater's.
 */
export const TEMPLATER_CONFIG_PATH = '.obsidian/plugins/templater-obsidian/data.json';

export interface FolderTemplate {
	/** Vault-relative folder. Templater writes the vault root as `/`; normalised to `''` here. */
	folder: string;
	/** Vault-relative path to the template note. */
	template: string;
}

export interface TemplaterSettings {
	/** Where templates live, e.g. `Templates`. Null when Templater is not installed. */
	templatesFolder: string | null;
	enableFolderTemplates: boolean;
	folderTemplates: FolderTemplate[];
}

interface RawTemplater {
	templates_folder?: string;
	enable_folder_templates?: boolean;
	folder_templates?: { folder?: string; template?: string }[];
}

export async function readTemplaterSettings(adapter: VaultAdapter): Promise<TemplaterSettings> {
	const raw = await readJson<RawTemplater>(adapter, TEMPLATER_CONFIG_PATH);

	return {
		templatesFolder: raw?.templates_folder?.trim() || null,
		enableFolderTemplates: raw?.enable_folder_templates ?? false,
		folderTemplates: (raw?.folder_templates ?? [])
			// Templater keeps an empty pair in its list when the user has never added one.
			.filter((entry) => (entry.template ?? '').trim() !== '')
			.map((entry) => ({
				folder: normaliseFolder(entry.folder ?? ''),
				template: entry.template!.trim()
			}))
	};
}

/**
 * The template Templater would apply to a note created in `folder`, or null for none.
 *
 * Matches Templater's own resolution: the most specific folder that is an ancestor of (or equal to)
 * the destination wins, with `/` as the catch-all. Returns null when folder templates are switched
 * off, so lull-pm honours that setting rather than quietly using the list anyway.
 */
export function templateForFolder(settings: TemplaterSettings, folder: string): string | null {
	if (!settings.enableFolderTemplates) return null;

	const target = normaliseFolder(folder);
	let best: FolderTemplate | null = null;

	for (const entry of settings.folderTemplates) {
		const matches =
			entry.folder === '' || target === entry.folder || target.startsWith(`${entry.folder}/`);
		if (!matches) continue;
		if (!best || entry.folder.length > best.folder.length) best = entry;
	}

	return best?.template ?? null;
}

function normaliseFolder(folder: string): string {
	const trimmed = folder.trim();
	if (trimmed === '/' || trimmed === '') return '';
	return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

/* -------------------------------------------------------------------------- */
/* lull-pm's own config                                                        */
/* -------------------------------------------------------------------------- */

export interface LullPmConfig {
	/** Folders lull-pm reads its objects from, in case a vault names them differently. */
	folders: {
		tasks: string;
		projects: string;
		companies: string;
		goals: string;
		buckets: string;
		/** Where Obsidian drops a new note. Not a typed folder — see `AuditManager`. */
		inbox: string;
	};
}

export const DEFAULT_CONFIG: LullPmConfig = {
	folders: {
		tasks: 'Tasks',
		projects: 'Projects',
		companies: 'Companies',
		goals: 'Goals',
		buckets: 'Categories/Buckets',
		inbox: '_Inbox Notes'
	}
};

export async function readLullConfig(adapter: VaultAdapter): Promise<LullPmConfig> {
	const raw = await readJson<Partial<LullPmConfig>>(adapter, LULL_CONFIG_PATH);
	if (!raw) return structuredClone(DEFAULT_CONFIG);

	return {
		folders: { ...DEFAULT_CONFIG.folders, ...raw.folders }
	};
}

/**
 * Write lull-pm's keys into `.lull/config.json`, preserving any keys another lull app (e.g.
 * lull-obsidian-app's habit grouping) has already written there.
 */
export async function writeLullConfig(adapter: VaultAdapter, config: LullPmConfig): Promise<void> {
	await adapter.mkdir('.lull');
	const existing = (await readJson<Record<string, unknown>>(adapter, LULL_CONFIG_PATH)) ?? {};
	const merged = { ...existing, folders: config.folders };
	await adapter.write(LULL_CONFIG_PATH, `${JSON.stringify(merged, null, '\t')}\n`);
}

/* -------------------------------------------------------------------------- */

async function readJson<T>(adapter: VaultAdapter, path: string): Promise<T | null> {
	try {
		if (!(await adapter.exists(path))) return null;
		return JSON.parse(await adapter.read(path)) as T;
	} catch {
		// A malformed config is not worth failing startup over; the defaults are sane.
		return null;
	}
}
