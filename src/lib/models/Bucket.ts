import type { Task } from './Task';

/**
 * A "life bucket" — the coarse area a task belongs to (work vs. personal, one org vs. another).
 * There is no bucket note type: a bucket is just a distinct value of a task's `org:` property,
 * already load-bearing across the real vault's tasks and `.base` filters.
 */
export interface Bucket {
	name: string;
	taskCount: number;
}

/** Every distinct `org` value across tasks, alphabetical, each with its task count. */
export function bucketsFrom(tasks: Task[]): Bucket[] {
	const counts = new Map<string, number>();

	for (const task of tasks) {
		for (const name of task.org) {
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.map(([name, taskCount]) => ({ name, taskCount }))
		.sort((a, b) => a.name.localeCompare(b.name));
}
