<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import ProjectCard from './components/ProjectCard.svelte';
	import NewProjectDialog from './components/NewProjectDialog.svelte';
	import ProjectDetailSheet from './components/ProjectDetailSheet.svelte';
	import BucketFilter from '$lib/components/buckets/BucketFilter.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Project } from '$lib/models/Project';
	import { bucketsFrom } from '$lib/models/Bucket';

	let newProjectOpen = $state(false);
	let detailOpen = $state(false);
	let selectedPath = $state<string | null>(null);
	let selectedBucket = $state<string | null>(null);

	$effect(() => {
		if (
			vaultState.status === 'ready' &&
			projectState.projects.length === 0 &&
			!projectState.isLoading
		) {
			void projectManager.load();
		}
		if (vaultState.status === 'ready' && taskState.tasks.length === 0 && !taskState.isLoading) {
			void taskManager.load();
		}
	});

	// Follow the vault: an edit made in Obsidian should show up here without a manual refresh.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let disposeProjects: (() => void) | undefined;
		let disposeTasks: (() => void) | undefined;
		void adapter.watch(() => projectManager.refreshQuietly()).then((fn) => (disposeProjects = fn));
		void adapter.watch(() => taskManager.refreshQuietly()).then((fn) => (disposeTasks = fn));
		return () => {
			disposeProjects?.();
			disposeTasks?.();
		};
	});

	const buckets = $derived(bucketsFrom(taskState.tasks, projectState.projects));
	const visibleProjects = $derived(
		selectedBucket === null
			? projectState.projects
			: projectState.projects.filter((project) => project.org.includes(selectedBucket!))
	);

	function taskCountFor(project: Project): number {
		return taskState.tasks.filter((task) => task.projects.includes(project.name)).length;
	}

	function openProject(project: Project) {
		selectedPath = project.path;
		detailOpen = true;
	}
</script>

<svelte:head>
	<title>lull-pm — projects</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="flex flex-wrap items-start justify-between gap-4 pb-6">
		<h1 class="text-2xl font-medium">Projects</h1>
		<Button variant="outline" size="sm" onclick={() => (newProjectOpen = true)}>
			<PlusIcon class="size-4" />
			New project
		</Button>
	</header>

	<div class="pb-6">
		<BucketFilter {buckets} bind:selected={selectedBucket} />
	</div>

	{#if projectState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{projectState.error}</span>
		</div>
	{/if}

	{#if projectState.isLoading && projectState.projects.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if projectState.projects.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No projects found. lull-pm reads them from notes in <code class="font-mono">Projects/</code
				>.
			</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newProjectOpen = true)}>
				Create the first one
			</Button>
		</div>
	{:else if visibleProjects.length === 0}
		<p class="py-16 text-center text-sm text-muted-foreground">
			No projects in {selectedBucket}.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each visibleProjects as project (project.path)}
				<ProjectCard
					{project}
					taskCount={taskCountFor(project)}
					onclick={() => openProject(project)}
				/>
			{/each}
		</div>
	{/if}
</main>

<NewProjectDialog
	bind:open={newProjectOpen}
	onClose={() => (newProjectOpen = false)}
	onCreated={(path) => {
		newProjectOpen = false;
		selectedPath = path;
		detailOpen = true;
	}}
/>

<ProjectDetailSheet bind:open={detailOpen} path={selectedPath} />
