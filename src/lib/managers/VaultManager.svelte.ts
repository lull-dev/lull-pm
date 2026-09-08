/**
 * Which vault lull is looking at.
 *
 * Opening a vault is the app's only real setup step — there is no account, no database and no
 * sync, so once a folder is chosen everything else follows from it.
 */

import { browser } from '$app/environment';
import type { VaultAdapter } from '$lib/vault/adapter';
import { isTauri, TauriVaultAdapter } from '$lib/vault/adapter.tauri';
import { createSampleVault } from '$lib/vault/sample';

const LAST_VAULT_KEY = 'lull-pm.vault.path';

export type VaultStatus = 'idle' | 'opening' | 'ready' | 'error';

export const vaultState = $state({
	adapter: null as VaultAdapter | null,
	status: 'idle' as VaultStatus,
	error: null as string | null,
	/** True when running in a browser tab against the sample vault rather than a real folder. */
	isSample: false
});

export const vaultManager = {
	/** Ask the user for a folder, then open it. Desktop only. */
	async pickFolder(): Promise<void> {
		if (!isTauri()) {
			this.openSample();
			return;
		}

		const { open } = await import('@tauri-apps/plugin-dialog');
		const chosen = await open({
			directory: true,
			multiple: false,
			title: 'Choose your Obsidian vault'
		});
		if (typeof chosen !== 'string') return;

		await this.openPath(chosen);
	},

	async openPath(root: string): Promise<void> {
		vaultState.status = 'opening';
		vaultState.error = null;

		try {
			// The vault is chosen at runtime, so it cannot be in Tauri's static capability scope.
			// Rust widens the fs scope to exactly this folder and nothing else, which means a path
			// bug on this side cannot reach the rest of the disk even if it tries.
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('allow_vault', { path: root });

			const adapter = new TauriVaultAdapter(root);

			// A vault without .obsidian is probably not the folder the user meant. Worth saying so
			// plainly rather than showing an empty habit list and letting them wonder.
			if (!(await adapter.exists('.obsidian'))) {
				throw new Error(
					`"${root}" does not look like an Obsidian vault — it has no .obsidian folder.`
				);
			}

			vaultState.adapter = adapter;
			vaultState.isSample = false;
			vaultState.status = 'ready';
			if (browser) localStorage.setItem(LAST_VAULT_KEY, root);
		} catch (error) {
			vaultState.adapter = null;
			vaultState.status = 'error';
			vaultState.error = error instanceof Error ? error.message : String(error);
		}
	},

	/** Open the in-memory sample vault, for browser development. */
	openSample(): void {
		vaultState.adapter = createSampleVault();
		vaultState.isSample = true;
		vaultState.status = 'ready';
		vaultState.error = null;
	},

	/**
	 * Reopen whatever was open last time.
	 *
	 * In a browser tab there is nothing to reopen, so the sample vault stands in and the app is
	 * usable immediately.
	 */
	async restore(): Promise<void> {
		if (!browser) return;

		if (!isTauri()) {
			this.openSample();
			return;
		}

		const last = localStorage.getItem(LAST_VAULT_KEY);
		if (last) await this.openPath(last);
	},

	close(): void {
		vaultState.adapter = null;
		vaultState.status = 'idle';
		vaultState.error = null;
		vaultState.isSample = false;
		if (browser) localStorage.removeItem(LAST_VAULT_KEY);
	},

	/** Open a note in Obsidian, so anything lull cannot do is one click away. */
	async openInObsidian(path: string): Promise<void> {
		if (!vaultState.adapter) return;
		const { obsidianUri } = await import('$lib/vault/adapter');
		const uri = obsidianUri(vaultState.adapter, path);

		if (isTauri()) {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(uri);
		} else {
			window.open(uri, '_blank');
		}
	}
};
