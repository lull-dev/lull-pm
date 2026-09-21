<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import AlertDialogPortal from './alert-dialog-portal.svelte';
	import AlertDialogOverlay from './alert-dialog-overlay.svelte';
	import { cn, type WithoutChild, type WithoutChildrenOrChild } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		size = 'default',
		portalProps,
		...restProps
	}: WithoutChild<AlertDialogPrimitive.ContentProps> & {
		size?: 'default' | 'sm';
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof AlertDialogPortal>>;
	} = $props();
</script>

<AlertDialogPortal {...portalProps}>
	<AlertDialogOverlay />
	<!--
		Centred by flex layout rather than `top/left-1/2` plus `-translate-1/2`.

		Transform centring offsets the dialog by half its own size, so any dialog with an odd pixel
		height lands on a half-pixel — and because the entry animation promotes it to a composited
		layer, the browser rasterises that layer and then resamples it at the fractional offset,
		which visibly blurs the text. Laying the dialog out in a centring flex container keeps it on
		whole pixels and leaves no transform behind once the animation finishes, so the text stays
		sharp. The wrapper is click-through so dismissal still reaches the overlay underneath.
	-->
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
		<AlertDialogPrimitive.Content
			bind:ref
			data-slot="alert-dialog-content"
			data-size={size}
			class={cn(
				'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg group/alert-dialog-content pointer-events-auto grid w-full outline-none',
				className
			)}
			{...restProps}
		/>
	</div>
</AlertDialogPortal>
