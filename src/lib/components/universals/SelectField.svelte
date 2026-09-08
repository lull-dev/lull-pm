<script lang="ts">
	import { cn } from '$lib/utils';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

	interface Option {
		value: string;
		label: string;
	}

	interface SelectFieldProps {
		value?: string;
		options: Option[];
		placeholder?: string;
		disabled?: boolean;
		size?: 'sm' | 'default';
		class?: string;
	}

	let {
		value = $bindable(''),
		options,
		placeholder = 'Select option',
		disabled = false,
		size = 'default',
		class: className = ''
	}: SelectFieldProps = $props();

	const selectedLabel = $derived(options.find((option) => option.value === value)?.label ?? '');
</script>

<Select type="single" bind:value {disabled}>
	<SelectTrigger class={cn('w-full', className)} {size}>
		{selectedLabel || placeholder}
	</SelectTrigger>
	<SelectContent class="w-[var(--bits-select-anchor-width)]">
		{#each options as option (option.value)}
			<SelectItem value={option.value} label={option.label}>{option.label}</SelectItem>
		{/each}
	</SelectContent>
</Select>
