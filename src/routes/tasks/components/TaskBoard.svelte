<script lang="ts">
	import { priorityRank, type Task, type TaskStatus } from '$lib/models/Task';
	import TaskCard from './TaskCard.svelte';

	interface Props {
		tasks: Task[];
		onselect: (task: Task) => void;
	}

	let { tasks, onselect }: Props = $props();

	/** Matches `Tasks.base`'s Board view: everything but Archived, grouped by status. */
	const COLUMNS: TaskStatus[] = ['Todo', 'In Progress', 'Blocked', 'Done'];

	function sortTasks(tasks: Task[]): Task[] {
		return [...tasks].sort((a, b) => {
			const rank = priorityRank(a.priority) - priorityRank(b.priority);
			if (rank !== 0) return rank;
			if (a.due && b.due) return a.due.localeCompare(b.due);
			if (a.due) return -1;
			if (b.due) return 1;
			return a.name.localeCompare(b.name);
		});
	}

	const columns = $derived(
		COLUMNS.map((status) => ({
			status,
			tasks: sortTasks(tasks.filter((task) => task.status === status))
		}))
	);
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	{#each columns as column (column.status)}
		<section class="flex min-w-0 flex-col gap-2">
			<h2
				class="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
			>
				{column.status}
				<span class="text-muted-foreground/60">{column.tasks.length}</span>
			</h2>
			<div class="flex flex-col gap-2">
				{#each column.tasks as task (task.path)}
					<TaskCard {task} onclick={() => onselect(task)} />
				{/each}
				{#if column.tasks.length === 0}
					<p class="px-1 text-xs text-muted-foreground/60">No tasks</p>
				{/if}
			</div>
		</section>
	{/each}
</div>
