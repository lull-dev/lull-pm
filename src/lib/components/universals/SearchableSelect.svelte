<script lang="ts">
	/**
	 * A single-select combobox: type to filter, pick from what matches. Built on bits-ui's Combobox,
	 * reusing the same styled SelectContent/SelectItem the plain SelectField uses underneath — the
	 * two primitives share that implementation, so the styling carries over unchanged.
	 */
	import { Combobox } from 'bits-ui';
	import { SelectContent, SelectItem } from '$lib/components/ui/select';
	import { cn } from '$lib/utils';
	import SearchIcon from '@lucide/svelte/icons/search';

	interface Props {
		value?: string;
		options: string[];
		placeholder?: string;
		onValueChange?: (value: string) => void;
		class?: string;
	}

	let {
		value,
		options,
		placeholder = 'Search…',
		onValueChange,
		class: className = ''
	}: Props = $props();

	let open = $state(false);
	let search = $state('');

	const filtered = $derived(
		search.trim() === ''
			? options
			: options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))
	);
</script>

<Combobox.Root
	type="single"
	{value}
	inputValue={value ?? ''}
	bind:open
	onValueChange={(next) => {
		if (next) onValueChange?.(next);
		search = '';
	}}
>
	<div class="relative">
		<SearchIcon
			class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
		/>
		<Combobox.Input
			{placeholder}
			onfocus={() => (open = true)}
			oninput={(e) => {
				search = e.currentTarget.value;
				open = true;
			}}
			class={cn(
				'border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent pl-7 pr-2 text-xs shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
				className
			)}
		/>
	</div>
	<SelectContent class="w-[var(--bits-select-anchor-width)]">
		{#each filtered as option (option)}
			<SelectItem value={option} label={option}>{option}</SelectItem>
		{/each}
		{#if filtered.length === 0}
			<p class="px-2 py-1.5 text-xs text-muted-foreground">No matches</p>
		{/if}
	</SelectContent>
</Combobox.Root>
