<script lang="ts">
	import type { Bucket } from '$lib/models/Bucket';

	interface Props {
		buckets: Bucket[];
		/** How many tasks sit in each bucket, by bucket name. */
		counts: Record<string, number>;
		/** null means "All". */
		selected: string | null;
	}

	let { buckets, counts, selected = $bindable(null) }: Props = $props();

	function chipClass(active: boolean): string {
		return `rounded-md border px-3 py-1.5 text-xs transition ${
			active ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
		}`;
	}
</script>

{#if buckets.length > 0}
	<div class="flex flex-wrap gap-2">
		<button type="button" class={chipClass(selected === null)} onclick={() => (selected = null)}>
			All
		</button>
		{#each buckets as bucket (bucket.path)}
			<button
				type="button"
				class={chipClass(selected === bucket.name)}
				onclick={() => (selected = bucket.name)}
			>
				{bucket.name}
				<span class="opacity-60">{counts[bucket.name] ?? 0}</span>
			</button>
		{/each}
	</div>
{/if}
