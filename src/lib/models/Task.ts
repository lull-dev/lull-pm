import type { Checkbox } from '$lib/vault/checkbox';

/**
 * A task is a note in `Tasks/`.
 *
 * `Inbox` is where a task starts: captured, but with no `due` or `do` date yet, so nothing has
 * decided when it happens. Triaging a task means giving it one of those dates and moving it to
 * `Whenever` (no particular date needed) or `Unstarted` (scheduled, just not begun).
 */
export const TASK_STATUSES = ['Inbox', 'Whenever', 'Unstarted', 'In Progress', 'Done'] as const;
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
	/** The deadline, `YYYY-MM-DD`, or null when unset. */
	due: string | null;
	/** The date this is planned to be worked, `YYYY-MM-DD`, or null when unset. */
	doDate: string | null;
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

/** True while a task has neither a deadline nor a planned date — the reason it belongs in Inbox. */
export function isUntriaged(task: Task): boolean {
	return task.due === null && task.doDate === null;
}

/**
 * The urgency flag the board shows: done, overdue, due soon, or nothing.
 *
 * Overdue and "soon" are judged against the deadline; a task with no deadline never flags this way,
 * even if it has a planned `doDate` in the past — that date is a plan, not a promise.
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
