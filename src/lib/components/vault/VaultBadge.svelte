<script lang="ts">
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import VaultIcon from '@lucide/svelte/icons/vault';
	import { Button } from '$lib/components/ui/button';

	const label = $derived(vaultState.adapter?.name ?? 'No vault');
</script>

<div class="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0">
	<VaultIcon class="size-4 shrink-0 text-muted-foreground" />
	<div class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
		<div class="truncate text-sm font-medium" title={vaultState.adapter?.root}>{label}</div>
		{#if vaultState.isSample}
			<div class="text-[10px] uppercase tracking-wide text-muted-foreground">sample</div>
		{/if}
	</div>
	{#if vaultState.status === 'ready'}
		<Button
			variant="ghost"
			size="sm"
			class="h-6 px-2 text-xs group-data-[collapsible=icon]:hidden"
			onclick={() => vaultManager.close()}
		>
			Change
		</Button>
	{/if}
</div>
