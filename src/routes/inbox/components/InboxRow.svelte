<script lang="ts">
	import { taskManager } from '$lib/managers/TaskManager.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SearchableSelect from '$lib/components/universals/SearchableSelect.svelte';
	import type { Task } from '$lib/models/Task';

	interface Props {
		task: Task;
		bucketOptions: string[];
		projectOptions: string[];
		onopen: () => void;
	}

	let { task, bucketOptions, projectOptions, onopen }: Props = $props();
</script>

<div class="rounded-lg border p-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			<Badge>Inbox</Badge>
			<button type="button" class="truncate text-sm font-medium hover:underline" onclick={onopen}>
				{task.name}
			</button>
		</div>
		<div class="flex shrink-0 gap-1.5">
			<Button
				variant="outline"
				size="xs"
				onclick={() => taskManager.setStatus(task.path, 'Whenever')}
			>
				→ Whenever
			</Button>
			<Button
				variant="outline"
				size="xs"
				onclick={() => taskManager.setStatus(task.path, 'Unstarted')}
			>
				→ Unstarted
			</Button>
		</div>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
		<div>
			<label
				class="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground"
				for="do-{task.path}"
			>
				Do date
			</label>
			<Input
				id="do-{task.path}"
				type="date"
				class="h-8 text-xs"
				value={task.doDate ?? ''}
				onchange={(e) =>
					taskManager.setDoDate(task.path, (e.currentTarget as HTMLInputElement).value || null)}
			/>
		</div>
		<div>
			<label
				class="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground"
				for="due-{task.path}"
			>
				Deadline
			</label>
			<Input
				id="due-{task.path}"
				type="date"
				class="h-8 text-xs"
				value={task.due ?? ''}
				onchange={(e) =>
					taskManager.setDue(task.path, (e.currentTarget as HTMLInputElement).value || null)}
			/>
		</div>
		<div>
			<span class="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
				Bucket
			</span>
			<SearchableSelect
				value={task.org[0]}
				options={bucketOptions}
				placeholder="Search buckets…"
				onValueChange={(value) => taskManager.setOrg(task.path, [value])}
			/>
		</div>
		<div>
			<span class="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
				Project
			</span>
			<SearchableSelect
				value={task.projects[0]}
				options={projectOptions}
				placeholder="Search projects…"
				onValueChange={(value) => taskManager.setProjects(task.path, [value])}
			/>
		</div>
	</div>
</div>
