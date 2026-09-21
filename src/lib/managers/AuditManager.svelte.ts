/**
 * The overview's state.
 *
 * Unlike every other manager, this one has no mutations — there is nothing to mutate. The audit
 * reads the vault and reports; what to do about any of it is the user's call, made in Obsidian.
 */

import { auditVault, countByKind, type Finding } from '$lib/vault/audit';
import { indexVault } from '$lib/vault/notes';
import { readLullConfig, type LullPmConfig } from '$lib/vault/settings';
import { vaultState } from './VaultManager.svelte';

export const auditState = $state({
	findings: [] as Finding[],
	/** How many notes were read, so an empty result reads as "checked and clean". */
	notesChecked: 0,
	isLoading: false,
	error: null as string | null,
	/**
	 * When the last scan finished, as epoch milliseconds, or null before the first one.
	 *
	 * A number rather than a `Date` because a `Date` in `$state` is a mutable object Svelte cannot
	 * track, and this only ever needs "has it run yet".
	 */
	ranAt: null as number | null
});

/**
 * The folders that hold a *type* of note. The inbox is not one: a note in `_Inbox Notes/` has not
 * been decided yet, and having no category there is the point of the folder.
 */
function typedFolders(config: LullPmConfig): string[] {
	const { inbox, ...typed } = config.folders;
	void inbox;
	return Object.values(typed);
}

export const auditManager = {
	reset(): void {
		auditState.findings = [];
		auditState.notesChecked = 0;
		auditState.ranAt = null;
	},

	async run(): Promise<void> {
		if (!vaultState.adapter) return;

		auditState.isLoading = true;
		auditState.error = null;
		try {
			const config = await readLullConfig(vaultState.adapter);
			const index = await indexVault(vaultState.adapter);

			auditState.findings = auditVault(index, { typedFolders: typedFolders(config) });
			auditState.notesChecked = index.all.length;
			auditState.ranAt = Date.now();
		} catch (error) {
			auditState.error = error instanceof Error ? error.message : String(error);
		} finally {
			auditState.isLoading = false;
		}
	}
};

/** Counts per kind, for the summary row. */
export function auditCounts() {
	return countByKind(auditState.findings);
}
