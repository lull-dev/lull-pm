<script lang="ts">
	import { bucketManager } from '$lib/managers/BucketManager.svelte';
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

	interface Props {
		open: boolean;
		onCreated: (path: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), onCreated, onClose }: Props = $props();

	let name = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	async function submit(event: Event) {
		event.preventDefault();
		if (name.trim() === '') return;

		saving = true;
		error = null;
		try {
			const bucket = await bucketManager.createBucket(name.trim());
			name = '';
			onCreated(bucket.path);
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
				<AlertDialogTitle>New bucket</AlertDialogTitle>
				<AlertDialogDescription>
					Creates a note in <code class="font-mono">Categories/Buckets/</code> with
					<code class="font-mono">categories: [[Buckets]]</code>, which is how lull-pm and your
					<code class="font-mono">.base</code> files both find it. The folder is created if it does not
					exist; nothing else in your vault is touched.
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="my-4 flex flex-col gap-4">
				<Input bind:value={name} placeholder="Personal" autofocus />

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<AlertDialogFooter>
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button type="submit" disabled={saving || name.trim() === ''}>Create bucket</Button>
			</AlertDialogFooter>
		</form>
	</AlertDialogContent>
</AlertDialog>
