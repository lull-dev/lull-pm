<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { taskFlag, priorityRank, type Task } from '$lib/models/Task';

	interface Props {
		task: Task;
		onclick: () => void;
	}

	let { task, onclick }: Props = $props();

	const flag = $derived(taskFlag(task));
	const priorityVariant = $derived(
		priorityRank(task.priority) <= 2 ? 'destructive' : ('outline' as const)
	);
</script>

<Card class="cursor-pointer gap-2 p-3 py-3 transition hover:ring-2 hover:ring-ring/40" {onclick}>
	<div class="flex items-start justify-between gap-2">
		<p class="text-sm font-medium leading-snug">{task.name}</p>
		{#if flag === 'overdue'}
			<span class="shrink-0 text-xs text-destructive" title="Overdue">●</span>
		{:else if flag === 'soon'}
			<span class="shrink-0 text-xs text-amber-500" title="Due soon">●</span>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-1.5">
		<Badge variant={priorityVariant}>{task.priority}</Badge>
		{#if task.due}
			<span class="text-xs text-muted-foreground">{task.due}</span>
		{/if}
	</div>

	{#if task.org.length > 0 || task.projects.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each task.org as org (org)}
				<Badge variant="secondary">{org}</Badge>
			{/each}
			{#each task.projects as project (project)}
				<Badge variant="outline">{project}</Badge>
			{/each}
		</div>
	{/if}
</Card>
