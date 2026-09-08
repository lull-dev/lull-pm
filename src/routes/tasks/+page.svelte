<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import TaskBoard from './components/TaskBoard.svelte';
	import NewTaskDialog from './components/NewTaskDialog.svelte';
	import TaskDetailSheet from './components/TaskDetailSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Task } from '$lib/models/Task';

	let newTaskOpen = $state(false);
	let detailOpen = $state(false);
	let selectedPath = $state<string | null>(null);

	$effect(() => {
		if (vaultState.status === 'ready' && taskState.tasks.length === 0 && !taskState.isLoading) {
			void taskManager.load();
		}
	});

	// Follow the vault: an edit made in Obsidian should show up here without a manual refresh.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let dispose: (() => void) | undefined;
		void adapter.watch(() => taskManager.refreshQuietly()).then((fn) => (dispose = fn));
		return () => dispose?.();
	});

	function openTask(task: Task) {
		selectedPath = task.path;
		detailOpen = true;
	}
</script>

<svelte:head>
	<title>lull-pm — tasks</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="flex flex-wrap items-start justify-between gap-4 pb-8">
		<h1 class="text-2xl font-medium">Tasks</h1>
		<Button variant="outline" size="sm" onclick={() => (newTaskOpen = true)}>
			<PlusIcon class="size-4" />
			New task
		</Button>
	</header>

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
	{:else if taskState.tasks.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No tasks found. lull-pm reads them from notes in <code class="font-mono">Tasks/</code>.
			</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newTaskOpen = true)}>
				Create the first one
			</Button>
		</div>
	{:else}
		<TaskBoard tasks={taskState.tasks} onselect={openTask} />
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
