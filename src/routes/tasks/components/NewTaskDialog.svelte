<script lang="ts">
	import { taskManager } from '$lib/managers/TaskManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		AlertDialog,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { TASK_PRIORITIES, type TaskPriority } from '$lib/models/Task';

	interface Props {
		open: boolean;
		onCreated: (path: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), onCreated, onClose }: Props = $props();

	let name = $state('');
	let priority = $state<TaskPriority>('Medium');
	let saving = $state(false);
	let error = $state<string | null>(null);

	async function submit(event: Event) {
		event.preventDefault();
		if (name.trim() === '') return;

		saving = true;
		error = null;
		try {
			const task = await taskManager.createTask(name.trim(), { priority });
			name = '';
			priority = 'Medium';
			onCreated(task.path);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<form onsubmit={submit}>
			<AlertDialogHeader>
				<AlertDialogTitle>New task</AlertDialogTitle>
				<AlertDialogDescription>
					Creates a note in <code class="font-mono">Tasks/</code>, from your vault's Task Template
					when it has one.
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="my-4 flex flex-col gap-4">
				<Input bind:value={name} placeholder="Ship the task board" autofocus />

				<div class="flex gap-2">
					{#each TASK_PRIORITIES as option (option)}
						<button
							type="button"
							onclick={() => (priority = option)}
							class="rounded-md border px-3 py-1.5 text-xs transition
								{priority === option ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}"
						>
							{option}
						</button>
					{/each}
				</div>

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<AlertDialogFooter>
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button type="submit" disabled={saving || name.trim() === ''}>Create task</Button>
			</AlertDialogFooter>
		</form>
	</AlertDialogContent>
</AlertDialog>
