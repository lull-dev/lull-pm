<script lang="ts">
	import { auditManager, auditState } from '$lib/managers/AuditManager.svelte';
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import type { Finding, FindingKind } from '$lib/vault/audit';

	$effect(() => {
		if (vaultState.status === 'ready' && auditState.ranAt === null && !auditState.isLoading) {
			void auditManager.run();
		}
	});

	// Follow the vault: fixing a note in Obsidian should drop it off this page without a reload.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		let dispose: (() => void) | undefined;
		void adapter.watch(() => auditManager.run()).then((fn) => (dispose = fn));
		return () => dispose?.();
	});

	const GROUPS: { kind: FindingKind; heading: string; blurb: string }[] = [
		{
			kind: 'unparseable-frontmatter',
			heading: 'lull-pm cannot write these',
			blurb:
				'Their frontmatter does not parse. lull-pm will show them, but it refuses every write to a note it cannot read cleanly — changing one could damage the rest of the file.'
		},
		{
			kind: 'two-kinds',
			heading: 'Connected to two things at once',
			blurb:
				'A project belongs to a company or a bucket; a task to a project or a bucket. Never both. lull-pm shows the more specific one and changes nothing.'
		},
		{
			kind: 'too-many-parents',
			heading: 'Connected to more than one of the same kind',
			blurb: 'One parent each. lull-pm shows the first and changes nothing.'
		},
		{
			kind: 'uncategorised',
			heading: 'Invisible to lull-pm',
			blurb:
				'lull-pm finds notes by their `categories:` property, the same way your .base files do. These look like they belong to it but claim no category, so they never show up.'
		},
		{
			kind: 'legacy-bucket-flag',
			heading: 'Using the retired bucket flag',
			blurb:
				'`bucket: true` dates from when a bucket was a property of a project. Buckets are their own notes now, and the flag does nothing.'
		}
	];

	const grouped = $derived(
		GROUPS.map((group) => ({
			...group,
			findings: auditState.findings.filter((finding) => finding.kind === group.kind)
		})).filter((group) => group.findings.length > 0)
	);

	const blocking = $derived(auditState.findings.filter((f) => f.severity === 'blocking').length);

	function open(finding: Finding) {
		void vaultManager.openInObsidian(finding.path);
	}
</script>

<svelte:head>
	<title>lull-pm — overview</title>
</svelte:head>

<main class="mx-auto w-full max-w-4xl p-6 md:p-10">
	<header class="flex flex-wrap items-start justify-between gap-4 pb-2">
		<div>
			<h1 class="text-base font-medium">Overview</h1>
			<p class="max-w-prose pt-1 text-sm text-muted-foreground">
				Notes lull-pm could not place. Nothing here has been changed — your vault is yours, and
				every one of these is a decision only you can make. Each one opens in Obsidian.
			</p>
		</div>
		<Button
			variant="outline"
			size="xs"
			disabled={auditState.isLoading}
			onclick={() => auditManager.run()}
		>
			<RefreshCwIcon class="size-4 {auditState.isLoading ? 'animate-spin' : ''}" />
			Rescan
		</Button>
	</header>

	{#if auditState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{auditState.error}</span>
		</div>
	{/if}

	{#if auditState.isLoading && auditState.ranAt === null}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if auditState.findings.length === 0 && auditState.ranAt !== null}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<CircleCheckIcon class="mx-auto size-6 text-muted-foreground" />
			<p class="pt-3 text-sm font-medium">Nothing to flag</p>
			<p class="pt-1 text-sm text-muted-foreground">
				All {auditState.notesChecked} notes fit the structure lull-pm reads.
			</p>
		</div>
	{:else}
		<p class="pb-6 text-sm text-muted-foreground">
			{auditState.findings.length}
			{auditState.findings.length === 1 ? 'note' : 'notes'} of {auditState.notesChecked}
			{#if blocking > 0}
				— <span class="font-medium text-destructive">{blocking} lull-pm cannot write</span>
			{/if}
		</p>

		<div class="flex flex-col gap-8">
			{#each grouped as group (group.kind)}
				<section>
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-medium">{group.heading}</h2>
						<Badge variant="outline">{group.findings.length}</Badge>
					</div>
					<p class="max-w-prose pt-1 text-xs text-muted-foreground">{group.blurb}</p>

					<div class="flex flex-col gap-2 pt-3">
						{#each group.findings as finding (finding.path + finding.kind)}
							<Card
								class="cursor-pointer gap-1 p-3 transition hover:ring-2 hover:ring-ring/40"
								onclick={() => open(finding)}
							>
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-medium">{finding.title}</p>
										<p class="truncate pt-0.5 font-mono text-xs text-muted-foreground">
											{finding.path}
										</p>
									</div>
									{#if finding.severity === 'blocking'}
										<Badge variant="destructive">read-only</Badge>
									{/if}
									<ExternalLinkIcon class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
								</div>
								<p class="pt-1.5 text-xs">{finding.detail}</p>
								<p class="text-xs text-muted-foreground">{finding.suggestion}</p>
							</Card>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</main>
