<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import TaskCard from '$lib/components/tasks/TaskCard.svelte';
	import TaskDetailSheet from '$lib/components/tasks/TaskDetailSheet.svelte';
	import BucketFilter from '$lib/components/buckets/BucketFilter.svelte';
	import { Spinner } from '$lib/components/ui/spinner';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { priorityRank, type Task } from '$lib/models/Task';
	import { bucketsFrom } from '$lib/models/Bucket';
	import { normalizeToMidnight, formatLocalDateYMD } from '$lib/utils/DateHelper';

	let detailOpen = $state(false);
	let selectedPath = $state<string | null>(null);
	let selectedBucket = $state<string | null>(null);

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

	const buckets = $derived(bucketsFrom(taskState.tasks));
	const scoped = $derived(
		selectedBucket === null
			? taskState.tasks
			: taskState.tasks.filter((task) => task.org.includes(selectedBucket!))
	);

	function sortByPriority(list: Task[]): Task[] {
		return [...list].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
	}

	const todayDate = normalizeToMidnight(new Date());
	const todayIso = formatLocalDateYMD(todayDate);

	// Today: planned for today, or planned for a day that's already passed and still not done —
	// a task with a plan should never silently fall off the radar just because its day passed.
	const todayTasks = $derived(
		sortByPriority(
			scoped.filter(
				(task) => task.status !== 'Done' && task.doDate !== null && task.doDate <= todayIso
			)
		)
	);

	const weekDays = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const date = new Date(todayDate);
			date.setDate(date.getDate() + i);
			const iso = formatLocalDateYMD(date);
			return {
				iso,
				label:
					i === 0
						? 'Today'
						: date.toLocaleDateString(undefined, {
								weekday: 'short',
								day: 'numeric',
								month: 'short'
							}),
				tasks: sortByPriority(scoped.filter((task) => task.doDate === iso))
			};
		})
	);

	function openTask(task: Task) {
		selectedPath = task.path;
		detailOpen = true;
	}
</script>

<svelte:head>
	<title>lull-pm — today</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="flex flex-wrap items-center justify-between gap-4 pb-3">
		<h1 class="text-base font-medium">Today</h1>
	</header>

	<div class="pb-6">
		<BucketFilter {buckets} bind:selected={selectedBucket} />
	</div>

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
	{:else}
		<section class="pb-10">
			<h2 class="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				Today · {todayTasks.length}
			</h2>
			{#if todayTasks.length === 0}
				<p class="text-sm text-muted-foreground">Nothing planned for today.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each todayTasks as task (task.path)}
						<TaskCard {task} onclick={() => openTask(task)} />
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<h2 class="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				This week
			</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
				{#each weekDays as day (day.iso)}
					<section class="flex min-w-0 flex-col gap-2">
						<h3
							class="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							{day.label}
							<span class="text-muted-foreground/60">{day.tasks.length}</span>
						</h3>
						<div class="flex flex-col gap-2">
							{#each day.tasks as task (task.path)}
								<TaskCard {task} onclick={() => openTask(task)} />
							{/each}
							{#if day.tasks.length === 0}
								<p class="px-1 text-xs text-muted-foreground/60">No tasks</p>
							{/if}
						</div>
					</section>
				{/each}
			</div>
		</section>
	{/if}
</main>

<TaskDetailSheet bind:open={detailOpen} path={selectedPath} />
