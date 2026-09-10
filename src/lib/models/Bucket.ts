import type { Task } from './Task';
import type { Project } from './Project';

/**
 * A "life bucket" — the coarse area a task or project belongs to (work vs. personal, one org vs.
 * another). There is no bucket note type: a bucket is just a distinct value of the `org:` property,
 * already load-bearing across the real vault's tasks, projects and `.base` filters.
 */
export interface Bucket {
	name: string;
	taskCount: number;
	projectCount: number;
}

/** Every distinct `org` value across tasks and projects, alphabetical, each with its counts. */
export function bucketsFrom(tasks: Task[], projects: Project[]): Bucket[] {
	const counts = new Map<string, { tasks: number; projects: number }>();

	for (const task of tasks) {
		for (const name of task.org) {
			const entry = counts.get(name) ?? { tasks: 0, projects: 0 };
			entry.tasks++;
			counts.set(name, entry);
		}
	}
	for (const project of projects) {
		for (const name of project.org) {
			const entry = counts.get(name) ?? { tasks: 0, projects: 0 };
			entry.projects++;
			counts.set(name, entry);
		}
	}

	return [...counts.entries()]
		.map(([name, count]) => ({ name, taskCount: count.tasks, projectCount: count.projects }))
		.sort((a, b) => a.name.localeCompare(b.name));
}
