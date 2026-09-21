<script lang="ts">
	import { companyManager, companyState } from '$lib/managers/CompanyManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { goalManager, goalState } from '$lib/managers/GoalManager.svelte';
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Company } from '$lib/models/Company';

	$effect(() => {
		if (vaultState.status !== 'ready') return;
		if (companyState.companies.length === 0 && !companyState.isLoading) void companyManager.load();
		if (projectState.projects.length === 0 && !projectState.isLoading) void projectManager.load();
		if (goalState.goals.length === 0 && !goalState.isLoading) void goalManager.load();
	});

	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		const disposers: (() => void)[] = [];
		for (const refresh of [
			() => companyManager.refreshQuietly(),
			() => projectManager.refreshQuietly(),
			() => goalManager.refreshQuietly()
		]) {
			void adapter.watch(refresh).then((fn) => disposers.push(fn));
		}
		return () => disposers.forEach((dispose) => dispose());
	});

	function projectsFor(company: Company) {
		return projectState.projects.filter(
			(project) => project.parent?.kind === 'company' && project.parent.name === company.name
		);
	}

	function goalsFor(company: Company) {
		return goalState.goals.filter(
			(goal) => goal.parent?.kind === 'company' && goal.parent.name === company.name
		);
	}
</script>

<svelte:head>
	<title>lull-pm — companies</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="pb-3">
		<h1 class="text-base font-medium">Companies</h1>
		<p class="max-w-prose pt-1 text-sm text-muted-foreground">
			Found by <code class="font-mono">categories: [[Companies]]</code>, wherever the note lives —
			which is how your <code class="font-mono">.base</code> files find them too. Written by hand in Obsidian;
			lull-pm only reads them.
		</p>
	</header>

	{#if companyState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{companyState.error}</span>
		</div>
	{/if}

	{#if companyState.isLoading && companyState.companies.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if companyState.companies.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No notes claim <code class="font-mono">categories: [[Companies]]</code>. Add that property
				in Obsidian to a note and it will show up here.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each companyState.companies as company (company.path)}
				<Card
					class="cursor-pointer gap-2 p-4 transition hover:ring-2 hover:ring-ring/40"
					onclick={() => vaultManager.openInObsidian(company.path)}
				>
					<p class="text-sm font-medium leading-snug">{company.name}</p>
					<div class="flex flex-wrap items-center gap-1.5">
						<Badge variant="outline">
							{projectsFor(company).length}
							{projectsFor(company).length === 1 ? 'project' : 'projects'}
						</Badge>
						{#if goalsFor(company).length > 0}
							<Badge variant="outline">
								{goalsFor(company).length}
								{goalsFor(company).length === 1 ? 'goal' : 'goals'}
							</Badge>
						{/if}
					</div>
					{#if company.folder}
						<p class="truncate font-mono text-xs text-muted-foreground">{company.folder}/</p>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</main>
