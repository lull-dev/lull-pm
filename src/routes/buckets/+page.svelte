<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import ProjectCard from '../projects/components/ProjectCard.svelte';
	import NewProjectDialog from '../projects/components/NewProjectDialog.svelte';
	import ProjectDetailSheet from '../projects/components/ProjectDetailSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Project } from '$lib/models/Project';

	let newBucketOpen = $state(false);
	let detailOpen = $state(false);
	let selectedPath = $state<string | null>(null);

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

	// A bucket is just a project with bucket: true — same note type, own page.
	const buckets = $derived(projectState.projects.filter((project) => project.bucket));

	function taskCountFor(project: Project): number {
		return taskState.tasks.filter((task) => task.org.includes(project.name)).length;
	}

	function openBucket(project: Project) {
		selectedPath = project.path;
		detailOpen = true;
	}
</script>

<svelte:head>
	<title>lull-pm — buckets</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="flex flex-wrap items-center justify-between gap-4 pb-3">
		<h1 class="text-base font-medium">Buckets</h1>
		<Button variant="outline" size="xs" onclick={() => (newBucketOpen = true)}>
			<PlusIcon class="size-4" />
			New bucket
		</Button>
	</header>

	{#if projectState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{projectState.error}</span>
		</div>
	{/if}

	{#if projectState.isLoading && buckets.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if buckets.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No buckets found. A bucket is a project note in <code class="font-mono">Projects/</code>
				with
				<code class="font-mono">bucket: true</code>.
			</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newBucketOpen = true)}>
				Create the first one
			</Button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each buckets as project (project.path)}
				<ProjectCard
					{project}
					taskCount={taskCountFor(project)}
					onclick={() => openBucket(project)}
				/>
			{/each}
		</div>
	{/if}
</main>

<NewProjectDialog
	kind="bucket"
	bind:open={newBucketOpen}
	onClose={() => (newBucketOpen = false)}
	onCreated={(path) => {
		newBucketOpen = false;
		selectedPath = path;
		detailOpen = true;
	}}
/>

<ProjectDetailSheet bind:open={detailOpen} path={selectedPath} />
