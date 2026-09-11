<script lang="ts">
	/**
	 * The desktop window ships with no native decorations (see tauri.conf.json) — GTK/Linux gives no
	 * way to shrink the OS title bar, only hide it entirely, so this replaces it with a thin strip
	 * of our own. `data-tauri-drag-region` is what makes it draggable; a plain click still reaches
	 * the close button underneath, since a drag only starts once the pointer actually moves.
	 *
	 * Never rendered outside Tauri — a browser tab has no window chrome to replace.
	 */
	import { isTauri } from '$lib/vault/adapter.tauri';
	import XIcon from '@lucide/svelte/icons/x';

	async function close() {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().close();
	}
</script>

{#if isTauri()}
	<div
		data-tauri-drag-region
		class="flex h-7 shrink-0 select-none items-center justify-between border-b border-border bg-sidebar pl-3 text-xs text-muted-foreground"
	>
		<span data-tauri-drag-region class="pointer-events-none">lull-pm</span>
		<button
			type="button"
			onclick={close}
			aria-label="Close"
			class="flex h-7 w-9 items-center justify-center hover:bg-destructive/20 hover:text-destructive"
		>
			<XIcon class="size-3.5" />
		</button>
	</div>
{/if}
