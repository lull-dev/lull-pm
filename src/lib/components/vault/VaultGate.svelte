<script lang="ts">
	/**
	 * Nothing in lull works without a vault, so this is the first thing the app renders.
	 * It restores the last vault on load and otherwise asks for one.
	 */
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import { isTauri } from '$lib/vault/adapter.tauri';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { children } = $props();
	let restoring = $state(true);

	$effect(() => {
		vaultManager.restore().finally(() => (restoring = false));
	});
</script>

{#if restoring || vaultState.status === 'opening'}
	<div class="flex h-screen items-center justify-center">
		<Spinner class="size-6 text-muted-foreground" />
	</div>
{:else if vaultState.status === 'ready'}
	{@render children()}
{:else}
	<div class="flex h-screen items-center justify-center p-8">
		<div class="max-w-md text-center">
			<h1 class="text-2xl font-medium">Open your vault</h1>
			<p class="mt-3 text-sm text-muted-foreground">
				lull-pm reads and writes your notes directly. Tasks are notes in
				<code class="font-mono">Tasks/</code>, projects are notes in
				<code class="font-mono">Projects/</code>. There is no database and nothing to import.
			</p>

			{#if vaultState.error}
				<div
					class="mt-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-left text-sm"
				>
					<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
					<span>{vaultState.error}</span>
				</div>
			{/if}

			<div class="mt-6 flex flex-col items-center gap-3">
				<Button onclick={() => vaultManager.pickFolder()}>
					<FolderOpenIcon class="size-4" />
					Choose vault folder
				</Button>

				{#if !isTauri()}
					<p class="text-xs text-muted-foreground">
						Running in a browser, so there is no filesystem to reach — this opens an in-memory
						sample vault instead. Use <code class="font-mono">npm run tauri dev</code> for a real one.
					</p>
				{:else}
					<p class="text-xs text-muted-foreground">
						Point this at a <strong>copy</strong> of your vault until you trust it.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
