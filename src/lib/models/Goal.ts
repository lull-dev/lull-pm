import type { Parent, ParentViolation } from './Parent';

/**
 * A goal is a note that says `categories: [[Goals]]`.
 *
 * The vault has a `Categories/Goals.md` note already but no goals written against it yet, so this
 * is the one type lull-pm meets empty. Its shape is therefore the smallest thing that is useful and
 * consistent with the others: a name, a freeform status, and the one connection the rule allows.
 *
 * Like projects, status is not pinned to a fixed set — `GOAL_STATUSES` are quick picks offered in
 * the UI, never enforced on read.
 */
export const GOAL_STATUSES = ['Idea', 'In Progress', 'On Hold', 'Done'] as const;

export interface Goal {
	/** Vault-relative path. This is the goal's identity. */
	path: string;
	/** Basename without `.md`, `!` stripped. */
	name: string;
	/** Freeform. Empty string means unset. */
	status: string;
	/** What this goal is connected to: a company **or** a bucket, never both. */
	parent: Parent | null;
	/** Set when the note's links break the one-parent rule, so the UI can offer to fix it. */
	parentViolation: ParentViolation | null;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
