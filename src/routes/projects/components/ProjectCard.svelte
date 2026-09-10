<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import type { Project } from '$lib/models/Project';

	interface Props {
		project: Project;
		taskCount: number;
		onclick: () => void;
	}

	let { project, taskCount, onclick }: Props = $props();
</script>

<Card class="cursor-pointer gap-2 p-4 transition hover:ring-2 hover:ring-ring/40" {onclick}>
	<p class="text-sm font-medium leading-snug">{project.name}</p>

	<div class="flex flex-wrap items-center gap-1.5">
		{#if project.status}
			<Badge variant="outline">{project.status}</Badge>
		{/if}
		<span class="text-xs text-muted-foreground">
			{taskCount}
			{taskCount === 1 ? 'task' : 'tasks'}
		</span>
	</div>

	{#if project.org.length > 0 || project.clients.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each project.org as org (org)}
				<Badge variant="secondary">{org}</Badge>
			{/each}
			{#each project.clients as client (client)}
				<Badge variant="outline">{client}</Badge>
			{/each}
		</div>
	{/if}
</Card>
