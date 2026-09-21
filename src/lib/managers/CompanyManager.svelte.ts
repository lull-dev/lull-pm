/**
 * Company state for the UI. Read-only, like the service — see `CompanyService` for why.
 */

import { CompanyService } from '$lib/services/vault/CompanyService';
import type { Company } from '$lib/models/Company';
import { indexManager } from './IndexManager.svelte';
import { vaultState } from './VaultManager.svelte';

export const companyState = $state({
	companies: [] as Company[],
	isLoading: false,
	error: null as string | null
});

let service: CompanyService | null = null;

async function requireService(): Promise<CompanyService> {
	if (!vaultState.adapter) throw new Error('No vault is open.');
	service ??= await CompanyService.open(vaultState.adapter);
	return service;
}

export const companyManager = {
	reset(): void {
		service = null;
		companyState.companies = [];
	},

	async load(): Promise<void> {
		companyState.isLoading = true;
		companyState.error = null;
		try {
			const service = await requireService();
			companyState.companies = service.listCompanies(await indexManager.ensure());
		} catch (error) {
			companyState.error = error instanceof Error ? error.message : String(error);
		} finally {
			companyState.isLoading = false;
		}
	},

	async refreshQuietly(): Promise<void> {
		try {
			indexManager.invalidate();
			const service = await requireService();
			companyState.companies = service.listCompanies(await indexManager.ensure());
		} catch {
			// A refresh that fails is not worth interrupting the user over; the next one will do.
		}
	}
};
