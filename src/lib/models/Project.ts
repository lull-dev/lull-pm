import type { Parent, ParentViolation } from './Parent';

/**
 * A project is a note in `Projects/`.
 *
 * Unlike Task status, the real vault never pinned project status to a fixed set of values — its own
 * `.base` filters match against whatever string is there ("In Progress", "Idea", "On Hold" all show
 * up). `PROJECT_STATUSES` is offered as quick picks in the UI, not enforced on read.
 */
export { DEFAULT_STATUSES as PROJECT_STATUSES } from './ProjectType';

export interface Project {
	/** Vault-relative path. This is the project's identity. */
	path: string;
	/** Basename without `.md` — the project's title, and what `projects:` on a task links to. */
	name: string;
	/** Freeform — see the module comment. Empty string means unset. */
	status: string;
	/**
	 * Which pipeline this project is on — the `type:` property, copied from the template it was
	 * created from. Empty string means the default type. See `models/ProjectType.ts`.
	 */
	type: string;
	/**
	 * What this project is connected to: a company **or** a bucket, never both.
	 * See `models/Parent.ts`.
	 */
	parent: Parent | null;
	/** Set when the note's links break the one-parent rule, so the UI can offer to fix it. */
	parentViolation: ParentViolation | null;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
