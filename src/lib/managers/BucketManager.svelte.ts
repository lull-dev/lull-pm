/**
 * Bucket state for the UI. Mirrors `ProjectManager`, with less to do: a bucket has a name and
 * nothing else to change, so there is no mutation here beyond creating one.
 */

import { BucketService } from '$lib/services/vault/BucketService';
import type { Bucket } from '$lib/models/Bucket';
import { indexManager } from './IndexManager.svelte';
import { vaultState } from './VaultManager.svelte';

export const bucketState = $state({
	buckets: [] as Bucket[],
	isLoading: false,
	error: null as string | null
});

let service: BucketService | null = null;

async function requireService(): Promise<BucketService> {
	if (!vaultState.adapter) throw new Error('No vault is open.');
	service ??= await BucketService.open(vaultState.adapter);
	return service;
}

export const bucketManager = {
	reset(): void {
		service = null;
		bucketState.buckets = [];
	},

	async load(): Promise<void> {
		bucketState.isLoading = true;
		bucketState.error = null;
		try {
			const service = await requireService();
			bucketState.buckets = service.listBuckets(await indexManager.ensure());
		} catch (error) {
			bucketState.error = message(error);
		} finally {
			bucketState.isLoading = false;
		}
	},

	async createBucket(name: string): Promise<Bucket> {
		bucketState.error = null;
		try {
			const service = await requireService();
			const bucket = await service.createBucket(name);
			// A new note changes what the index holds, so the next read must rebuild it.
			indexManager.invalidate();
			bucketState.buckets = [...bucketState.buckets, bucket].sort((a, b) =>
				a.name.localeCompare(b.name)
			);
			return bucket;
		} catch (error) {
			bucketState.error = message(error);
			throw error;
		}
	},

	async refreshQuietly(): Promise<void> {
		try {
			indexManager.invalidate();
			const service = await requireService();
			bucketState.buckets = service.listBuckets(await indexManager.ensure());
		} catch {
			// A refresh that fails is not worth interrupting the user over; the next one will do.
		}
	}
};

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
