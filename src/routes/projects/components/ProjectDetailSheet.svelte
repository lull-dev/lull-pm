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
	import ParentPicker from '$lib/components/parents/ParentPicker.svelte';
	import { projectTypeState } from '$lib/managers/ProjectTypeManager.svelte';
	import { statusesFor, typeFor } from '$lib/models/ProjectType';

	interface Props {
		open: boolean;
		path: string | null;
	}

	let { open = $bindable(), path }: Props = $props();

	const project = $derived(
		path ? (projectState.projects.find((p) => p.path === path) ?? null) : null
	);

	// The pipeline this project moves through, from the template its `type:` names.
	const type = $derived(typeFor(project?.type ?? '', projectTypeState.types));
	const statuses = $derived(statusesFor(project?.status ?? '', type));

	// A task belongs to this project when this project is its parent.
	const linkedTasks = $derived(
		project
			? taskState.tasks.filter(
					(task) => task.parent?.kind === 'project' && task.parent.name === project.name
				)
			: []
	);
</script>

<Sheet bind:open>
	<SheetContent class="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
		{#if project}
			{@const currentPath = project.path}
			<SheetHeader class="border-b">
				<SheetTitle class="flex items-center gap-2">
					{project.name}
					{#if project.type}
						<Badge variant="outline">{project.type}</Badge>
					{/if}
				</SheetTitle>
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
							{#each statuses as status (status)}
								<SelectItem value={status} label={status}>{status}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div>
					<span class="mb-1 block text-xs text-muted-foreground">Connected to</span>
					<ParentPicker
						type="project"
						parent={project.parent}
						placeholder="Search companies and buckets…"
						onChange={(parent) => projectManager.setParent(currentPath, parent)}
					/>
					{#if project.parentViolation}
						<p class="pt-1 text-xs text-destructive">
							This note is connected to more than one thing. Picking one here will fix it.
						</p>
					{/if}
				</div>

				<div>
					<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Tasks
					</h3>
					{#if linkedTasks.length === 0}
						<p class="text-xs text-muted-foreground">
							No tasks link here yet — set this project as a task's parent.
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
