<script lang="ts">
	import { projectTypeManager, projectTypeState } from '$lib/managers/ProjectTypeManager.svelte';
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	$effect(() => {
		if (vaultState.status === 'ready' && projectTypeState.types.length === 0) {
			void projectTypeManager.load();
		}
	});

	// Editing a template in Obsidian should change what shows here without a reload.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let dispose: (() => void) | undefined;
		void adapter.watch(() => projectTypeManager.refreshQuietly()).then((fn) => (dispose = fn));
		return () => dispose?.();
	});
</script>

<svelte:head>
	<title>lull-pm — settings</title>
</svelte:head>

<main class="mx-auto w-full max-w-3xl p-6 md:p-10">
	<header class="pb-6">
		<h1 class="text-base font-medium">Settings</h1>
	</header>

	<section>
		<h2 class="text-sm font-medium">Project types</h2>
		<p class="max-w-prose pt-1 text-sm text-muted-foreground">
			A project type is a template note. lull-pm reads every note in your Templater templates folder
			that claims <code class="font-mono">categories: [[Projects]]</code>, and takes its
			<code class="font-mono">type:</code>
			and <code class="font-mono">statuses:</code> properties. To add a type or change a pipeline, edit
			the template in Obsidian — lull-pm never writes one.
		</p>

		<pre class="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs"><code
				>---
categories:
  - "[[Projects]]"
type: Content
statuses: [Idea, Scripting, Filming, Editing, Review, Published]
status: Idea
---</code
			></pre>

		{#if projectTypeState.error}
			<div
				class="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
			>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
				<span>{projectTypeState.error}</span>
			</div>
		{/if}

		{#if projectTypeState.isLoading && projectTypeState.types.length === 0}
			<div class="flex justify-center py-10">
				<Spinner class="size-5 text-muted-foreground" />
			</div>
		{:else}
			<div class="flex flex-col gap-2 pt-4">
				{#each projectTypeState.types as type (type.template)}
					<Card
						class="cursor-pointer gap-2 p-3 transition hover:ring-2 hover:ring-ring/40"
						onclick={() => vaultManager.openInObsidian(type.template)}
					>
						<div class="flex items-start justify-between gap-3">
							<p class="text-sm font-medium">
								{type.name || 'Default'}
								{#if !type.name}
									<span class="pl-1 text-xs font-normal text-muted-foreground">
										— projects with no <code class="font-mono">type:</code>
									</span>
								{/if}
							</p>
							<ExternalLinkIcon class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
						</div>

						<div class="flex flex-wrap items-center gap-1">
							{#each type.statuses as status, i (status)}
								{#if i > 0}
									<span class="text-xs text-muted-foreground">→</span>
								{/if}
								<Badge variant={type.terminal.includes(status) ? 'default' : 'outline'}>
									{status}
								</Badge>
							{/each}
						</div>

						<p class="truncate font-mono text-xs text-muted-foreground">{type.template}</p>

						{#if type.folders.length > 0}
							<p class="text-xs text-muted-foreground">
								New notes in {type.folders.map((f) => `${f || '/'}/`).join(', ')} use this.
							</p>
						{/if}
					</Card>
				{/each}
			</div>
		{/if}
	</section>
</main>
