import type { Checkbox } from '$lib/vault/checkbox';

/**
 * A task is a note in `Tasks/`.
 *
 * The schema is not invented here — it is exactly what `Templates/Task Template.md` and
 * `Templates/Bases/Tasks.base` already expect in the real vault, so lull-pm reads and writes notes
 * that vault already understands.
 */
export const TASK_STATUSES = ['Todo', 'In Progress', 'Blocked', 'Done', 'Archived'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
	/** Vault-relative path. This is the task's identity. */
	path: string;
	/** Basename without `.md` — the task's title. */
	name: string;
	status: TaskStatus;
	priority: TaskPriority;
	/** Bucket(s) this task belongs to — the `org:` property, read as wikilink names. */
	org: string[];
	/** Project(s) this task belongs to, as wikilink names. */
	projects: string[];
	/** `YYYY-MM-DD`, or null when unset. */
	due: string | null;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
	/** `YYYY-MM-DD` the task was marked done, or null. */
	done: string | null;
	/** Content of the `## Why` section, trimmed. */
	why: string;
	/** Checkboxes found in the `## Steps` section. */
	steps: Checkbox[];
	/** Content of the `## Notes` section, trimmed. */
	notes: string;
}

/** Rank used to sort by priority, matching `Tasks.base`'s `formula.rank`. */
export function priorityRank(priority: TaskPriority): number {
	switch (priority) {
		case 'Urgent':
			return 1;
		case 'High':
			return 2;
		case 'Medium':
			return 3;
		case 'Low':
			return 4;
	}
}

/**
 * The urgency flag `Tasks.base` shows: done, overdue, due soon, or nothing.
 *
 * Mirrors the base's `formula.flag`: overdue if the due date has passed, "soon" inside three days.
 */
export type TaskFlag = 'done' | 'overdue' | 'soon' | null;

export function taskFlag(task: Task, today: Date = new Date()): TaskFlag {
	if (task.status === 'Done') return 'done';
	if (!task.due) return null;

	const due = new Date(`${task.due}T00:00:00`);
	const midnight = new Date(today);
	midnight.setHours(0, 0, 0, 0);

	const daysLeft = Math.round((due.getTime() - midnight.getTime()) / 86_400_000);
	if (daysLeft < 0) return 'overdue';
	if (daysLeft <= 3) return 'soon';
	return null;
}
