<script lang="ts">
	import type { Bucket } from '$lib/models/Bucket';

	interface Props {
		buckets: Bucket[];
		/** null means "All". */
		selected: string | null;
	}

	let { buckets, selected = $bindable(null) }: Props = $props();

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
		{#each buckets as bucket (bucket.name)}
			<button
				type="button"
				class={chipClass(selected === bucket.name)}
				onclick={() => (selected = bucket.name)}
			>
				{bucket.name}
				<span class="opacity-60">{bucket.taskCount + bucket.projectCount}</span>
			</button>
		{/each}
	</div>
{/if}
