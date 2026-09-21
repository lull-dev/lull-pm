import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { BucketService } from './BucketService';

const BUCKET = `---
categories:
  - "[[Buckets]]"
created: 2026-09-01
---
`;

let adapter: MemoryVaultAdapter;
let service: BucketService;

beforeEach(async () => {
	adapter = new MemoryVaultAdapter({
		'.obsidian/app.json': '{}',
		'Categories/Buckets/Work.md': BUCKET,
		'Categories/Buckets/Personal.md': BUCKET,
		'Projects/Marketing Website.md': '---\ncategories:\n  - "[[Projects]]"\n---\n'
	});
	service = await BucketService.open(adapter);
});

async function buckets() {
	return service.listBuckets(await indexVault(adapter));
}

describe('reading', () => {
	it('lists buckets alphabetically', async () => {
		expect((await buckets()).map((b) => b.name)).toEqual(['Personal', 'Work']);
	});

	it('does not confuse a project for a bucket', async () => {
		expect((await buckets()).map((b) => b.name)).not.toContain('Marketing Website');
	});

	it('reads the created date', async () => {
		expect((await service.readBucket('Categories/Buckets/Work.md')).created).toBe('2026-09-01');
	});

	it('finds a bucket note wherever it lives, since category is what identifies it', async () => {
		await adapter.write('Categories/Buckets/Nested/Side Projects.md', BUCKET);
		expect((await buckets()).map((b) => b.name)).toContain('Side Projects');
	});

	it('ignores a project still carrying the retired bucket flag', async () => {
		// That flag is dead. It is reported on the Overview page, never read as a bucket.
		await adapter.write(
			'Projects/Old.md',
			'---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n'
		);
		expect((await buckets()).map((b) => b.name)).not.toContain('Old');
	});
});

describe('creating', () => {
	it('creates a findable bucket note in the configured folder', async () => {
		const bucket = await service.createBucket('Side Quests', new Date('2026-09-19T12:00:00'));

		expect(bucket.path).toBe('Categories/Buckets/Side Quests.md');
		expect(await adapter.read(bucket.path)).toBe(
			'---\ncategories:\n  - "[[Buckets]]"\ncreated: 2026-09-19\n---\n'
		);
		expect((await buckets()).map((b) => b.name)).toContain('Side Quests');
	});

	it('does not create the category note or a base file — those are the user to write', async () => {
		await service.createBucket('Side Quests');

		expect(await adapter.exists('Categories/Buckets.md')).toBe(false);
		expect(await adapter.exists('Categories/Buckets/Buckets.base')).toBe(false);
	});

	it('refuses an empty name', async () => {
		await expect(service.createBucket('   ')).rejects.toThrow(/needs a name/);
	});

	it('refuses to overwrite an existing bucket', async () => {
		await expect(service.createBucket('Work')).rejects.toThrow(/already exists/);
	});
});
