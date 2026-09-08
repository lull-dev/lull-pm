<script lang="ts">
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

	interface TabRowProps {
		tabs: { label: string }[];
		active?: number;
		onSelect?: (index: number) => void;
	}

	let { tabs = [], active = 0, onSelect = undefined }: TabRowProps = $props();
	let activeValue = $state('0');

	function handleClick(i: number) {
		if (typeof onSelect === 'function') onSelect(i);
		activeValue = String(i);
	}

	$effect(() => {
		activeValue = String(active);
	});
</script>

<Tabs value={activeValue} class="w-fit">
	<TabsList>
		{#each tabs as t, i (i)}
			<TabsTrigger value={String(i)} onclick={() => handleClick(i)}>{t.label}</TabsTrigger>
		{/each}
	</TabsList>
</Tabs>
