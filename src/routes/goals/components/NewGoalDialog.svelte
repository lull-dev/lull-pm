<script lang="ts">
	import { goalManager } from '$lib/managers/GoalManager.svelte';
	import { bucketState } from '$lib/managers/BucketManager.svelte';
	import { companyState } from '$lib/managers/CompanyManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		AlertDialog,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { GOAL_STATUSES } from '$lib/models/Goal';
	import type { Parent } from '$lib/models/Parent';

	interface Props {
		open: boolean;
		onCreated: (path: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), onCreated, onClose }: Props = $props();

	let name = $state('');
	let status = $state('');
	let parentKey = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	/**
	 * One list, both kinds — which is what makes the rule unbreakable here: there is a single
	 * selection, so a goal cannot come out of this dialog connected to two things.
	 */
	const options = $derived([
		...companyState.companies.map((company) => ({
			key: `company:${company.name}`,
			label: company.name,
			kind: 'Company'
		})),
		...bucketState.buckets.map((bucket) => ({
			key: `bucket:${bucket.name}`,
			label: bucket.name,
			kind: 'Bucket'
		}))
	]);

	function parentFrom(key: string): Parent | null {
		if (key === '') return null;
		const [kind, ...rest] = key.split(':');
		return { kind: kind as Parent['kind'], name: rest.join(':') };
	}

	async function submit(event: Event) {
		event.preventDefault();
		if (name.trim() === '') return;

		saving = true;
		error = null;
		try {
			const goal = await goalManager.createGoal(name.trim(), {
				status: status || undefined,
				parent: parentFrom(parentKey)
			});
			name = '';
			status = '';
			parentKey = '';
			onCreated(goal.path);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<form onsubmit={submit}>
			<AlertDialogHeader>
				<AlertDialogTitle>New goal</AlertDialogTitle>
				<AlertDialogDescription>
					Creates a note in <code class="font-mono">Goals/</code> with
					<code class="font-mono">categories: [[Goals]]</code>. A goal connects to a company
					<em>or</em> a bucket — never both.
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="my-4 flex flex-col gap-4">
				<Input bind:value={name} placeholder="Ship lull-pm 1.0" autofocus />

				<div class="flex flex-wrap gap-2">
					{#each ['', ...GOAL_STATUSES] as option (option)}
						<button
							type="button"
							onclick={() => (status = option)}
							class="rounded-md border px-3 py-1.5 text-xs transition
								{status === option ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}"
						>
							{option === '' ? 'no status' : option}
						</button>
					{/each}
				</div>

				{#if options.length > 0}
					<select
						bind:value={parentKey}
						class="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
					>
						<option value="">Not connected</option>
						{#each options as option (option.key)}
							<option value={option.key}>{option.kind} — {option.label}</option>
						{/each}
					</select>
				{/if}

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<AlertDialogFooter>
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button type="submit" disabled={saving || name.trim() === ''}>Create goal</Button>
			</AlertDialogFooter>
		</form>
	</AlertDialogContent>
</AlertDialog>
