/**
 * The project types the vault defines. Read-only — templates are the user's, edited in Obsidian.
 */

import { ProjectTypeService } from '$lib/services/vault/ProjectTypeService';
import type { ProjectType } from '$lib/models/ProjectType';
import { vaultState } from './VaultManager.svelte';

export const projectTypeState = $state({
	types: [] as ProjectType[],
	isLoading: false,
	error: null as string | null
});

let service: ProjectTypeService | null = null;

export const projectTypeManager = {
	reset(): void {
		service = null;
		projectTypeState.types = [];
	},

	async load(): Promise<void> {
		if (!vaultState.adapter) return;

		projectTypeState.isLoading = true;
		projectTypeState.error = null;
		try {
			service ??= await ProjectTypeService.open(vaultState.adapter);
			projectTypeState.types = await service.listTypes();
		} catch (error) {
			projectTypeState.error = error instanceof Error ? error.message : String(error);
		} finally {
			projectTypeState.isLoading = false;
		}
	},

	/** Re-read after a template changes on disk. */
	async refreshQuietly(): Promise<void> {
		try {
			if (!vaultState.adapter) return;
			// The Templater config may have changed too, so build a fresh service rather than reusing
			// one that captured the old settings.
			service = await ProjectTypeService.open(vaultState.adapter);
			projectTypeState.types = await service.listTypes();
		} catch {
			// A refresh that fails is not worth interrupting the user over.
		}
	}
};
