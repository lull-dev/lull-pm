<script lang="ts">
	import { Button as UiButton } from '$lib/components/ui/button';

	interface ButtonProps {
		name: string;
		func?: () => void;
		type?: 'button' | 'submit';
		variant?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		name,
		func,
		type = 'button',
		variant = 'primary',
		disabled = false,
		class: className = ''
	}: ButtonProps = $props();

	const variantMap: Record<
		string,
		'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
	> = {
		primary: 'default',
		secondary: 'secondary',
		delete: 'destructive',
		default: 'default',
		outline: 'outline',
		ghost: 'ghost',
		link: 'link'
	};

	const shadcnVariant = $derived(variantMap[variant] ?? 'default');
</script>

<UiButton
	variant={shadcnVariant}
	class={className}
	{type}
	{disabled}
	onclick={() => func && func()}
>
	{name}
</UiButton>
