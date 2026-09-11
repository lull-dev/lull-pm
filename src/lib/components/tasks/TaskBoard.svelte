<script lang="ts">
	import { flip } from 'svelte/animate';
	import {
		dndzone,
		overrideItemIdKeyNameBeforeInitialisingDndZones,
		type DndEvent
	} from 'svelte-dnd-action';
	import { priorityRank, TASK_STATUSES, type Task, type TaskStatus } from '$lib/models/Task';
	import TaskCard from './TaskCard.svelte';

	// Tasks are identified by vault path, not an `id` field — tell the library once, before any
	// dndzone mounts, rather than wrapping every card in a synthetic { id, task } pair.
	overrideItemIdKeyNameBeforeInitialisingDndZones('path');

	interface Props {
		tasks: Task[];
		onselect: (task: Task) => void;
		onstatuschange: (path: string, status: TaskStatus) => void;
	}

	let { tasks, onselect, onstatuschange }: Props = $props();

	// Inbox and Whenever have their own dedicated triage views — the board only tracks tasks with an
	// active plan, so those two statuses never get a column here even though they're still valid
	// `TaskStatus` values a task can carry.
	const COLUMNS = TASK_STATUSES.filter((status) => status !== 'Inbox' && status !== 'Whenever');
	const FLIP_DURATION_MS = 180;

	function sortTasks(list: Task[]): Task[] {
		return [...list].sort((a, b) => {
			const rank = priorityRank(a.priority) - priorityRank(b.priority);
			if (rank !== 0) return rank;
			if (a.due && b.due) return a.due.localeCompare(b.due);
			if (a.due) return -1;
			if (b.due) return 1;
			return a.name.localeCompare(b.name);
		});
	}

	function emptyColumns(): Record<TaskStatus, Task[]> {
		return { Inbox: [], Whenever: [], Unstarted: [], 'In Progress': [], Done: [] };
	}

	/**
	 * svelte-dnd-action owns these arrays during a drag — it patches them directly via `consider`
	 * so the dragged card can preview its new position before anything is written to the vault.
	 * `dragging` stops an incoming prop update (e.g. a background vault refresh) from clobbering
	 * that in-progress drag.
	 */
	let columns = $state<Record<TaskStatus, Task[]>>(emptyColumns());
	let dragging = false;

	$effect(() => {
		if (dragging) return;
		const next = emptyColumns();
		for (const status of COLUMNS)
			next[status] = sortTasks(tasks.filter((t) => t.status === status));
		columns = next;
	});

	function consider(status: TaskStatus, e: CustomEvent<DndEvent<Task>>) {
		dragging = true;
		columns[status] = e.detail.items;
	}

	/**
	 * A card belongs wherever its own `status` says it does — every other task already dropped into
	 * this zone matches it by construction, so the one that doesn't is the one that just moved here.
	 * That holds for a same-zone reorder too: nothing there has a mismatched status, so it is
	 * correctly treated as a no-op rather than a write.
	 */
	function finalize(status: TaskStatus, e: CustomEvent<DndEvent<Task>>) {
		dragging = false;
		columns[status] = e.detail.items;

		const moved = e.detail.items.find((task) => task.status !== status);
		if (moved) onstatuschange(moved.path, status);
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each COLUMNS as status (status)}
		<section class="flex min-w-0 flex-col gap-2">
			<h2
				class="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
			>
				{status}
				<span class="text-muted-foreground/60">{columns[status].length}</span>
			</h2>
			<div
				class="flex min-h-16 flex-col gap-2 rounded-lg"
				use:dndzone={{
					items: columns[status],
					flipDurationMs: FLIP_DURATION_MS,
					// A short hold before a touch drag starts, so a finger scrolling the page past the
					// board doesn't get mistaken for the start of a drag.
					delayTouchStart: true,
					// The library's default is an inline yellow outline, which wins over dropTargetClasses
					// on specificity alone — has to be cleared for our classes to show instead.
					dropTargetStyle: {},
					dropTargetClasses: ['outline-2', 'outline-dashed', 'outline-primary/40', 'rounded-lg']
				}}
				onconsider={(e) => consider(status, e)}
				onfinalize={(e) => finalize(status, e)}
			>
				{#each columns[status] as task (task.path)}
					<div animate:flip={{ duration: FLIP_DURATION_MS }}>
						<TaskCard {task} onclick={() => onselect(task)} />
					</div>
				{/each}
				{#if columns[status].length === 0}
					<p class="px-1 text-xs text-muted-foreground/60">No tasks</p>
				{/if}
			</div>
		</section>
	{/each}
</div>
