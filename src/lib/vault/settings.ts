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
/* lull-pm's own config                                                        */
/* -------------------------------------------------------------------------- */

export interface LullPmConfig {
	/** Folders lull-pm reads its objects from, in case a vault names them differently. */
	folders: {
		tasks: string;
		projects: string;
		goals: string;
		inbox: string;
	};
}

export const DEFAULT_CONFIG: LullPmConfig = {
	folders: {
		tasks: 'Tasks',
		projects: 'Projects',
		goals: 'Goals',
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
