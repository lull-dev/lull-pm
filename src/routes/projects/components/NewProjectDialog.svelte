<script lang="ts">
	import { projectManager } from '$lib/managers/ProjectManager.svelte';
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
	import { PROJECT_STATUSES } from '$lib/models/Project';

	interface Props {
		open: boolean;
		/** A bucket is a project with `bucket: true` — this just sets the flag at creation time. */
		kind?: 'project' | 'bucket';
		onCreated: (path: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), kind = 'project', onCreated, onClose }: Props = $props();

	let name = $state('');
	let status = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	async function submit(event: Event) {
		event.preventDefault();
		if (name.trim() === '') return;

		saving = true;
		error = null;
		try {
			const project = await projectManager.createProject(name.trim(), {
				status: status || undefined,
				bucket: kind === 'bucket'
			});
			name = '';
			status = '';
			onCreated(project.path);
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
				<AlertDialogTitle>{kind === 'bucket' ? 'New bucket' : 'New project'}</AlertDialogTitle>
				<AlertDialogDescription>
					Creates a note in <code class="font-mono">Projects/</code>, from your vault's Project
					Template when it has one.
					{#if kind === 'bucket'}
						Buckets are projects too — just flagged with <code class="font-mono">bucket: true</code> so
						they show up here instead of on the Projects page.
					{/if}
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="my-4 flex flex-col gap-4">
				<Input bind:value={name} placeholder="lull.app" autofocus />

				<div class="flex gap-2">
					{#each ['', ...PROJECT_STATUSES] as option (option)}
						<button
							type="button"
							onclick={() => (status = option)}
							class="rounded-md border px-3 py-1.5 text-xs transition
								{status === option ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}"
						>
							{option === '' ? 'no status' : option}
						</button>
					{/each}
				</div>

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<AlertDialogFooter>
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button type="submit" disabled={saving || name.trim() === ''}>
					{kind === 'bucket' ? 'Create bucket' : 'Create project'}
				</Button>
			</AlertDialogFooter>
		</form>
	</AlertDialogContent>
</AlertDialog>
