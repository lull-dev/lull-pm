/**
 * Project state for the UI. Mirrors `TaskManager`: mutations call through the service and patch the
 * single project that changed back into the list.
 */

import { SvelteSet } from 'svelte/reactivity';
import type { CreateProjectOptions } from '$lib/services/vault/ProjectService';
import { ProjectService } from '$lib/services/vault/ProjectService';
import type { Project } from '$lib/models/Project';
import { vaultState } from './VaultManager.svelte';

export const projectState = $state({
	projects: [] as Project[],
	isLoading: false,
	error: null as string | null,
	pending: new SvelteSet<string>()
});

let service: ProjectService | null = null;

async function requireService(): Promise<ProjectService> {
	if (!vaultState.adapter) throw new Error('No vault is open.');
	service ??= await ProjectService.open(vaultState.adapter);
	return service;
}

function patch(project: Project): void {
	const index = projectState.projects.findIndex((p) => p.path === project.path);
	if (index === -1) {
		projectState.projects = [...projectState.projects, project];
	} else {
		projectState.projects = projectState.projects.map((p, i) => (i === index ? project : p));
	}
}

async function mutate(
	path: string,
	run: (service: ProjectService) => Promise<Project>
): Promise<void> {
	projectState.pending.add(path);
	projectState.error = null;
	try {
		const service = await requireService();
		patch(await run(service));
	} catch (error) {
		projectState.error = message(error);
	} finally {
		projectState.pending.delete(path);
	}
}

export const projectManager = {
	reset(): void {
		service = null;
		projectState.projects = [];
	},

	async load(): Promise<void> {
		projectState.isLoading = true;
		projectState.error = null;
		try {
			const service = await requireService();
			projectState.projects = await service.listProjects();
		} catch (error) {
			projectState.error = message(error);
		} finally {
			projectState.isLoading = false;
		}
	},

	async createProject(name: string, options: CreateProjectOptions = {}): Promise<Project> {
		projectState.error = null;
		try {
			const service = await requireService();
			const project = await service.createProject(name, options);
			patch(project);
			return project;
		} catch (error) {
			projectState.error = message(error);
			throw error;
		}
	},

	setStatus(path: string, status: string): Promise<void> {
		return mutate(path, (service) => service.setStatus(path, status));
	},

	async refreshQuietly(): Promise<void> {
		try {
			const service = await requireService();
			projectState.projects = await service.listProjects();
		} catch {
			// A refresh that fails is not worth interrupting the user over; the next one will do.
		}
	}
};

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
