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
	import { projectTypeState } from '$lib/managers/ProjectTypeManager.svelte';
	import { typeFor } from '$lib/models/ProjectType';

	interface Props {
		open: boolean;
		onCreated: (path: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), onCreated, onClose }: Props = $props();

	let name = $state('');
	let status = $state('');
	let typeName = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	const selected = $derived(typeFor(typeName, projectTypeState.types));
	const statuses = $derived(selected.statuses);

	/**
	 * Picking a type picks the template, and with it the folder Templater maps to that template —
	 * so a note lull-pm creates lands exactly where a note created in Obsidian would have.
	 */
	const template = $derived(projectTypeState.types.find((t) => t.name === typeName)?.template);
	const folder = $derived(projectTypeState.types.find((t) => t.name === typeName)?.folders[0]);

	// A type change should not leave a status from the previous pipeline selected.
	$effect(() => {
		if (status !== '' && !statuses.includes(status)) status = '';
	});

	async function submit(event: Event) {
		event.preventDefault();
		if (name.trim() === '') return;

		saving = true;
		error = null;
		try {
			const project = await projectManager.createProject(name.trim(), {
				status: status || undefined,
				template,
				folder: folder || undefined
			});
			name = '';
			status = '';
			typeName = '';
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
				<AlertDialogTitle>New project</AlertDialogTitle>
				<AlertDialogDescription>
					Creates a note in <code class="font-mono">{folder || 'Projects'}/</code>
					{#if template}
						from <code class="font-mono">{template}</code>
					{:else}
						from your vault's Project Template when it has one
					{/if}
					— the same template Templater would use for a note created there.
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="my-4 flex flex-col gap-4">
				<Input bind:value={name} placeholder="lull.app" autofocus />

				{#if projectTypeState.types.length > 1}
					<div class="flex flex-wrap gap-2">
						{#each projectTypeState.types as option (option.template)}
							<button
								type="button"
								onclick={() => (typeName = option.name)}
								class="rounded-md border px-3 py-1.5 text-xs transition
									{typeName === option.name ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}"
							>
								{option.name || 'Default'}
							</button>
						{/each}
					</div>
				{/if}

				<div class="flex flex-wrap gap-2">
					{#each ['', ...statuses] as option (option)}
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
				<Button type="submit" disabled={saving || name.trim() === ''}>Create project</Button>
			</AlertDialogFooter>
		</form>
	</AlertDialogContent>
</AlertDialog>
