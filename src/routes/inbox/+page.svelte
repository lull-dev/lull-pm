<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import InboxRow from './components/InboxRow.svelte';
	import NewTaskDialog from '$lib/components/tasks/NewTaskDialog.svelte';
	import TaskDetailSheet from '$lib/components/tasks/TaskDetailSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let newTaskOpen = $state(false);
	let detailOpen = $state(false);
	let selectedPath = $state<string | null>(null);

	$effect(() => {
		if (vaultState.status === 'ready' && taskState.tasks.length === 0 && !taskState.isLoading) {
			void taskManager.load();
		}
		if (
			vaultState.status === 'ready' &&
			projectState.projects.length === 0 &&
			!projectState.isLoading
		) {
			void projectManager.load();
		}
	});

	// Follow the vault: an edit made in Obsidian should show up here without a manual refresh.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let disposeTasks: (() => void) | undefined;
		let disposeProjects: (() => void) | undefined;
		void adapter.watch(() => taskManager.refreshQuietly()).then((fn) => (disposeTasks = fn));
		void adapter.watch(() => projectManager.refreshQuietly()).then((fn) => (disposeProjects = fn));
		return () => {
			disposeTasks?.();
			disposeProjects?.();
		};
	});

	// Most recently captured first, so triage works through what just landed here.
	const inboxTasks = $derived(
		taskState.tasks
			.filter((task) => task.status === 'Inbox')
			.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
	);

	// A bucket is a project note flagged bucket: true — this is the controlled vocabulary a task's
	// org field is assigned from, not just whatever values happen to already be in use.
	const bucketOptions = $derived(
		projectState.projects.filter((project) => project.bucket).map((project) => project.name)
	);
	const projectOptions = $derived(projectState.projects.map((project) => project.name));

	function openTask(path: string) {
		selectedPath = path;
		detailOpen = true;
	}
</script>

<svelte:head>
	<title>lull-pm — inbox</title>
</svelte:head>

<main class="mx-auto w-full max-w-3xl p-6 md:p-10">
	<header class="flex flex-wrap items-center justify-between gap-4 pb-2">
		<h1 class="text-base font-medium">Inbox</h1>
		<Button variant="outline" size="xs" onclick={() => (newTaskOpen = true)}>
			<PlusIcon class="size-4" />
			New task
		</Button>
	</header>
	<p class="pb-6 text-sm text-muted-foreground">
		Every task starts here, with no due date and no do date. Give one a date, a bucket or a project
		right here, then send it to Whenever (no rush) or Unstarted (it has a plan).
	</p>

	{#if taskState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{taskState.error}</span>
		</div>
	{/if}

	{#if taskState.isLoading && taskState.tasks.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if inboxTasks.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">Inbox is empty — everything has a plan.</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newTaskOpen = true)}>
				Capture something
			</Button>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each inboxTasks as task (task.path)}
				<InboxRow {task} {bucketOptions} {projectOptions} onopen={() => openTask(task.path)} />
			{/each}
		</div>
	{/if}
</main>

<NewTaskDialog
	bind:open={newTaskOpen}
	onClose={() => (newTaskOpen = false)}
	onCreated={(path) => {
		newTaskOpen = false;
		selectedPath = path;
		detailOpen = true;
	}}
/>

<TaskDetailSheet bind:open={detailOpen} path={selectedPath} />
