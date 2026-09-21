/**
 * A bucket is a note in `Categories/Buckets/`.
 *
 * It was not always. Buckets have been two other things in this app's short life: a distinct value
 * of the `org:` property, and then a `bucket: true` flag on a project note. Both were ways of
 * avoiding a new note type, and both were wrong in the same way — a bucket is a thing you name,
 * write about, and link to, which is exactly what a note is for.
 *
 * So a bucket is now a note like any other, found the way every other note type is found: by
 * `categories: [[Buckets]]`. lull-pm creates the folder when it first writes one. The
 * `Categories/Buckets.md` category note and any `.base` view are written by hand in Obsidian —
 * lull-pm reads whatever is there and creates neither.
 */

export interface Bucket {
	/** Vault-relative path. This is the bucket's identity. */
	path: string;
	/** Basename without `.md` — the bucket's name, and what `bucket:` links to. */
	name: string;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
