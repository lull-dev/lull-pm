/**
 * Buckets, read and written as notes in `Categories/Buckets/`.
 *
 * Same discipline as `TaskService` and `ProjectService`: reads come from the shared vault index,
 * by category rather than by folder, and every mutation goes through `editNote`.
 *
 * lull-pm creates `Categories/Buckets/` when it writes the first bucket, because it has to put the
 * note somewhere. It does not create `Categories/Buckets.md` or a `Buckets.base` — those are the
 * user's to write, and lull-pm works whether or not they exist.
 */

import { createNote, joinPath, noteName, type VaultAdapter } from '$lib/vault/adapter';
import { getString, parseNote } from '$lib/vault/frontmatter';
import type { VaultIndex } from '$lib/vault/notes';
import { readLullConfig } from '$lib/vault/settings';
import { formatDate } from '$lib/vault/templater';
import { formatWikilink } from '$lib/vault/wikilink';
import type { Bucket } from '$lib/models/Bucket';

/** The category a bucket note claims. */
export const BUCKET_CATEGORY = 'Buckets';

export class BucketService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string
	) {}

	static async open(adapter: VaultAdapter): Promise<BucketService> {
		const config = await readLullConfig(adapter);
		return new BucketService(adapter, config.folders.buckets);
	}

	/**
	 * Every bucket in the vault, alphabetical.
	 *
	 * Synchronous: the index already holds each note parsed, so there is nothing left to await.
	 */
	listBuckets(index: VaultIndex): Bucket[] {
		return index
			.byCategory(BUCKET_CATEGORY)
			.map((note) => ({
				path: note.path,
				name: note.title,
				created: getString(note.note, 'created') ?? null
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readBucket(path: string): Promise<Bucket> {
		const note = parseNote(await this.adapter.read(path));
		return {
			path,
			name: noteName(path).replace(/^!/, ''),
			created: getString(note, 'created') ?? null
		};
	}

	/**
	 * Create a bucket note.
	 *
	 * The frontmatter is the minimum that makes it findable — the category link, and the `created`
	 * date every other note type in this vault carries. Anything else the user wants on it, they add
	 * in Obsidian.
	 */
	async createBucket(name: string, today: Date = new Date()): Promise<Bucket> {
		const trimmed = name.trim();
		if (trimmed === '') throw new Error('A bucket needs a name.');

		const path = joinPath(this.folder, `${trimmed}.md`);
		const created = formatDate(today, { format: 'YYYY-MM-DD', offset: 0 });

		await createNote(
			this.adapter,
			path,
			'---\n' +
				'categories:\n' +
				`  - "${formatWikilink(BUCKET_CATEGORY)}"\n` +
				`created: ${created}\n` +
				'---\n'
		);

		return this.readBucket(path);
	}
}
