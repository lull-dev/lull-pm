<script lang="ts">
	import { goalManager, goalState } from '$lib/managers/GoalManager.svelte';
	import { bucketManager, bucketState } from '$lib/managers/BucketManager.svelte';
	import { companyManager, companyState } from '$lib/managers/CompanyManager.svelte';
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import NewGoalDialog from './components/NewGoalDialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { GOAL_STATUSES } from '$lib/models/Goal';

	let newGoalOpen = $state(false);

	$effect(() => {
		if (vaultState.status !== 'ready') return;
		if (goalState.goals.length === 0 && !goalState.isLoading) void goalManager.load();
		if (bucketState.buckets.length === 0 && !bucketState.isLoading) void bucketManager.load();
		if (companyState.companies.length === 0 && !companyState.isLoading) void companyManager.load();
	});

	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let dispose: (() => void) | undefined;
		void adapter.watch(() => goalManager.refreshQuietly()).then((fn) => (dispose = fn));
		return () => dispose?.();
	});

	const grouped = $derived(
		[...GOAL_STATUSES, ''].map((status) => ({
			status,
			goals: goalState.goals.filter((goal) => goal.status === status)
		}))
	);
</script>

<svelte:head>
	<title>lull-pm — goals</title>
</svelte:head>

<main class="mx-auto w-full max-w-4xl p-6 md:p-10">
	<header class="flex flex-wrap items-center justify-between gap-4 pb-3">
		<h1 class="text-base font-medium">Goals</h1>
		<Button variant="outline" size="xs" onclick={() => (newGoalOpen = true)}>
			<PlusIcon class="size-4" />
			New goal
		</Button>
	</header>

	{#if goalState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{goalState.error}</span>
		</div>
	{/if}

	{#if goalState.isLoading && goalState.goals.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if goalState.goals.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No goals yet. A goal is a note in <code class="font-mono">Goals/</code> with
				<code class="font-mono">categories: [[Goals]]</code>, connected to a bucket or a company.
			</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newGoalOpen = true)}>
				Create the first one
			</Button>
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			{#each grouped.filter((group) => group.goals.length > 0) as group (group.status)}
				<section>
					<h2 class="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						{group.status || 'No status'}
						<span class="opacity-60">{group.goals.length}</span>
					</h2>
					<div class="flex flex-col gap-2">
						{#each group.goals as goal (goal.path)}
							<Card
								class="cursor-pointer gap-1 p-3 transition hover:ring-2 hover:ring-ring/40"
								onclick={() => vaultManager.openInObsidian(goal.path)}
							>
								<div class="flex items-start justify-between gap-3">
									<p class="text-sm font-medium leading-snug">{goal.name}</p>
									{#if goal.parentViolation}
										<Badge variant="destructive">connected to two things</Badge>
									{:else if goal.parent}
										<Badge variant="outline">
											{goal.parent.kind === 'company' ? '🏢' : '🪣'}
											{goal.parent.name}
										</Badge>
									{/if}
								</div>
							</Card>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</main>

<NewGoalDialog
	bind:open={newGoalOpen}
	onClose={() => (newGoalOpen = false)}
	onCreated={() => (newGoalOpen = false)}
/>
