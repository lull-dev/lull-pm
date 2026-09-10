/**
 * A project is a note in `Projects/`.
 *
 * Unlike Task status, the real vault never pinned project status to a fixed set of values — its own
 * `.base` filters match against whatever string is there ("In Progress", "Idea", "On Hold" all show
 * up). `PROJECT_STATUSES` is offered as quick picks in the UI, not enforced on read.
 */
export const PROJECT_STATUSES = ['Idea', 'In Progress', 'On Hold', 'Done'] as const;

export interface Project {
	/** Vault-relative path. This is the project's identity. */
	path: string;
	/** Basename without `.md` — the project's title, and what `projects:` on a task links to. */
	name: string;
	/** Bucket(s) this project belongs to — the `org:` property, read as wikilink names. */
	org: string[];
	clients: string[];
	/** Freeform — see the module comment. Empty string means unset. */
	status: string;
	/** `YYYY-MM-DD`, or null when unset. */
	start: string | null;
	/** `YYYY-MM-DD`, or null when unset. */
	end: string | null;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
