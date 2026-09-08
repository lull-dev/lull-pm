<script lang="ts">
	import { goto } from '$app/navigation';

	$effect(() => {
		goto('/tasks', { replaceState: true });
	});
</script>
