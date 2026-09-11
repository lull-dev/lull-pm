<script lang="ts">
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { taskState } from '$lib/managers/TaskManager.svelte';
	import { vaultManager } from '$lib/managers/VaultManager.svelte';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { PROJECT_STATUSES } from '$lib/models/Project';

	interface Props {
		open: boolean;
		path: string | null;
	}

	let { open = $bindable(), path }: Props = $props();

	const project = $derived(
		path ? (projectState.projects.find((p) => p.path === path) ?? null) : null
	);

	const linkedTasks = $derived(
		project ? taskState.tasks.filter((task) => task.projects.includes(project.name)) : []
	);
</script>

<Sheet bind:open>
	<SheetContent class="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
		{#if project}
			{@const currentPath = project.path}
			<SheetHeader class="border-b">
				<SheetTitle>{project.name}</SheetTitle>
				<SheetDescription>
					<button
						type="button"
						class="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
						onclick={() => vaultManager.openInObsidian(currentPath)}
					>
						<ExternalLinkIcon class="size-3" />
						{currentPath}
					</button>
				</SheetDescription>
			</SheetHeader>

			<div class="flex flex-col gap-6 p-4">
				<div>
					<label class="mb-1 block text-xs text-muted-foreground" for="project-status">
						Status
					</label>
					<Select
						type="single"
						value={project.status}
						onValueChange={(value) => projectManager.setStatus(currentPath, value ?? '')}
					>
						<SelectTrigger id="project-status" class="w-full" size="sm">
							{project.status || 'No status'}
						</SelectTrigger>
						<SelectContent>
							{#each PROJECT_STATUSES as status (status)}
								<SelectItem value={status} label={status}>{status}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div>
					<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Tasks
					</h3>
					{#if linkedTasks.length === 0}
						<p class="text-xs text-muted-foreground">
							No tasks link here yet — add this project's name to a task's Projects field.
						</p>
					{:else}
						<div class="flex flex-col gap-1.5">
							{#each linkedTasks as task (task.path)}
								<div class="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
									<span>{task.name}</span>
									<Badge variant="outline">{task.status}</Badge>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</SheetContent>
</Sheet>
