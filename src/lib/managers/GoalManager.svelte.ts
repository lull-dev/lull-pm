/**
 * Goal state for the UI. Mirrors `ProjectManager`.
 */

import { SvelteSet } from 'svelte/reactivity';
import { GoalService, type CreateGoalOptions } from '$lib/services/vault/GoalService';
import type { Goal } from '$lib/models/Goal';
import type { Parent } from '$lib/models/Parent';
import { indexManager } from './IndexManager.svelte';
import { vaultState } from './VaultManager.svelte';

export const goalState = $state({
	goals: [] as Goal[],
	isLoading: false,
	error: null as string | null,
	pending: new SvelteSet<string>()
});

let service: GoalService | null = null;

async function requireService(): Promise<GoalService> {
	if (!vaultState.adapter) throw new Error('No vault is open.');
	service ??= await GoalService.open(vaultState.adapter);
	return service;
}

function patch(goal: Goal): void {
	const index = goalState.goals.findIndex((g) => g.path === goal.path);
	if (index === -1) {
		goalState.goals = [...goalState.goals, goal].sort((a, b) => a.name.localeCompare(b.name));
	} else {
		goalState.goals = goalState.goals.map((g, i) => (i === index ? goal : g));
	}
}

async function mutate(path: string, run: (service: GoalService) => Promise<Goal>): Promise<void> {
	goalState.pending.add(path);
	goalState.error = null;
	try {
		const service = await requireService();
		patch(await run(service));
	} catch (error) {
		goalState.error = message(error);
	} finally {
		goalState.pending.delete(path);
	}
}

export const goalManager = {
	reset(): void {
		service = null;
		goalState.goals = [];
	},

	async load(): Promise<void> {
		goalState.isLoading = true;
		goalState.error = null;
		try {
			const service = await requireService();
			goalState.goals = service.listGoals(await indexManager.ensure());
		} catch (error) {
			goalState.error = message(error);
		} finally {
			goalState.isLoading = false;
		}
	},

	async createGoal(name: string, options: CreateGoalOptions = {}): Promise<Goal> {
		goalState.error = null;
		try {
			const service = await requireService();
			const goal = await service.createGoal(name, options);
			// A new note changes what the index holds, so the next read must rebuild it.
			indexManager.invalidate();
			patch(goal);
			return goal;
		} catch (error) {
			goalState.error = message(error);
			throw error;
		}
	},

	setStatus(path: string, status: string): Promise<void> {
		return mutate(path, (service) => service.setStatus(path, status));
	},

	/** Connect the goal to a company or a bucket — never both. */
	setParent(path: string, parent: Parent | null): Promise<void> {
		return mutate(path, (service) => service.setParent(path, parent));
	},

	async refreshQuietly(): Promise<void> {
		try {
			indexManager.invalidate();
			const service = await requireService();
			goalState.goals = service.listGoals(await indexManager.ensure());
		} catch {
			// A refresh that fails is not worth interrupting the user over; the next one will do.
		}
	}
};

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
