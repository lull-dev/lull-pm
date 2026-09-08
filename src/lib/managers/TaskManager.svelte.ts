/**
 * Task state for the UI.
 *
 * Mutations call through the service and patch the single task that changed back into the list —
 * cheaper than reloading everything, and it keeps the list's order stable while one card updates.
 */

import { SvelteSet } from 'svelte/reactivity';
import type { CreateTaskOptions } from '$lib/services/vault/TaskService';
import { TaskService } from '$lib/services/vault/TaskService';
import type { Task, TaskPriority, TaskStatus } from '$lib/models/Task';
import { vaultState } from './VaultManager.svelte';

export const taskState = $state({
	tasks: [] as Task[],
	isLoading: false,
	error: null as string | null,
	/** Paths with a write in flight, so the UI can show them as pending. */
	pending: new SvelteSet<string>()
});

let service: TaskService | null = null;

async function requireService(): Promise<TaskService> {
	if (!vaultState.adapter) throw new Error('No vault is open.');
	service ??= await TaskService.open(vaultState.adapter);
	return service;
}

function patch(task: Task): void {
	const index = taskState.tasks.findIndex((t) => t.path === task.path);
	if (index === -1) {
		taskState.tasks = [...taskState.tasks, task];
	} else {
		taskState.tasks = taskState.tasks.map((t, i) => (i === index ? task : t));
	}
}

async function mutate(path: string, run: (service: TaskService) => Promise<Task>): Promise<void> {
	taskState.pending.add(path);
	taskState.error = null;
	try {
		const service = await requireService();
		patch(await run(service));
	} catch (error) {
		taskState.error = message(error);
	} finally {
		taskState.pending.delete(path);
	}
}

export const taskManager = {
	/** Drop the cached service, e.g. after the vault changes. */
	reset(): void {
		service = null;
		taskState.tasks = [];
	},

	async load(): Promise<void> {
		taskState.isLoading = true;
		taskState.error = null;
		try {
			const service = await requireService();
			taskState.tasks = await service.listTasks();
		} catch (error) {
			taskState.error = message(error);
		} finally {
			taskState.isLoading = false;
		}
	},

	async createTask(name: string, options: CreateTaskOptions = {}): Promise<Task> {
		taskState.error = null;
		try {
			const service = await requireService();
			const task = await service.createTask(name, options);
			patch(task);
			return task;
		} catch (error) {
			taskState.error = message(error);
			throw error;
		}
	},

	setStatus(path: string, status: TaskStatus): Promise<void> {
		return mutate(path, (service) => service.setStatus(path, status));
	},

	setPriority(path: string, priority: TaskPriority): Promise<void> {
		return mutate(path, (service) => service.setPriority(path, priority));
	},

	setDue(path: string, due: string | null): Promise<void> {
		return mutate(path, (service) => service.setDue(path, due));
	},

	setOrg(path: string, org: string[]): Promise<void> {
		return mutate(path, (service) => service.setOrg(path, org));
	},

	setProjects(path: string, projects: string[]): Promise<void> {
		return mutate(path, (service) => service.setProjects(path, projects));
	},

	toggleStep(path: string, index: number): Promise<void> {
		return mutate(path, (service) => service.toggleStep(path, index));
	},

	addStep(path: string, text: string): Promise<void> {
		return mutate(path, (service) => service.addStep(path, text));
	},

	setWhy(path: string, text: string): Promise<void> {
		return mutate(path, (service) => service.setWhy(path, text));
	},

	setNotes(path: string, text: string): Promise<void> {
		return mutate(path, (service) => service.setNotes(path, text));
	},

	/** Refresh after an external change, without the loading flicker. */
	async refreshQuietly(): Promise<void> {
		try {
			const service = await requireService();
			taskState.tasks = await service.listTasks();
		} catch {
			// A refresh that fails is not worth interrupting the user over; the next one will do.
		}
	}
};

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
