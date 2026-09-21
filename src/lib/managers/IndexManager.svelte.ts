/**
 * One read of the vault, shared by everything that needs it.
 *
 * `categories.ts` explains why a note's type comes from `categories:` rather than its folder, and
 * the cost of that: there is no folder to shortcut through, so finding projects means reading every
 * note. Done per service that would be four full walks — tasks, projects, companies, buckets — over
 * the same 1386 files. Done here it is one, and every service reads from the result.
 *
 * The index is a snapshot, not a subscription. It is rebuilt when the vault changes on disk, and
 * after a write lull-pm made itself; in between, callers get the same parsed notes rather than
 * re-reading them.
 */

import { indexVault, type VaultIndex } from '$lib/vault/notes';
import { vaultState } from './VaultManager.svelte';

export const indexState = $state({
	isLoading: false,
	/** Notes in the last snapshot, so pages can say what was searched. */
	noteCount: 0
});

let index: VaultIndex | null = null;
let inFlight: Promise<VaultIndex> | null = null;

export const indexManager = {
	/**
	 * The current snapshot, building it if there is none.
	 *
	 * Concurrent callers share one walk: three pages mounting at once should not read the vault
	 * three times.
	 */
	async ensure(): Promise<VaultIndex> {
		if (index) return index;
		if (inFlight) return inFlight;

		const adapter = vaultState.adapter;
		if (!adapter) throw new Error('No vault is open.');

		indexState.isLoading = true;
		inFlight = indexVault(adapter)
			.then((built) => {
				index = built;
				indexState.noteCount = built.all.length;
				return built;
			})
			.finally(() => {
				inFlight = null;
				indexState.isLoading = false;
			});

		return inFlight;
	},

	/** Drop the snapshot, so the next `ensure` re-reads. Called after a write or a vault change. */
	invalidate(): void {
		index = null;
	},

	reset(): void {
		index = null;
		inFlight = null;
		indexState.noteCount = 0;
	}
};
