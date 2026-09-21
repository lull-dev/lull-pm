<script lang="ts">
	/**
	 * One control for "what is this connected to".
	 *
	 * The rule — a bucket **or** a company/project, never both — is enforced by the shape of this
	 * component rather than by a check after the fact: there is one selection, so two connections
	 * cannot be expressed. Kinds the note's type does not allow are never offered.
	 */
	import SearchableSelect from '$lib/components/universals/SearchableSelect.svelte';
	import { PARENT_KINDS, type Parent, type ParentedType } from '$lib/models/Parent';
	import { bucketState } from '$lib/managers/BucketManager.svelte';
	import { companyState } from '$lib/managers/CompanyManager.svelte';
	import { projectState } from '$lib/managers/ProjectManager.svelte';

	interface Props {
		/** Which note type this is for — decides which kinds are offered. */
		type: ParentedType;
		parent: Parent | null;
		onChange: (parent: Parent | null) => void;
		placeholder?: string;
	}

	let { type, parent, onChange, placeholder = 'Search…' }: Props = $props();

	const NONE = '— not connected —';

	/**
	 * Labels carry their kind, because two things of different kinds can share a name: a bucket
	 * called "lull" and a company called "lull" must not collapse into one option.
	 */
	const entries = $derived(
		PARENT_KINDS[type].flatMap((kind) => {
			const names =
				kind === 'bucket'
					? bucketState.buckets.map((b) => b.name)
					: kind === 'company'
						? companyState.companies.map((c) => c.name)
						: projectState.projects.map((p) => p.name);

			return names.map((name) => ({ kind, name, label: `${label(kind)} — ${name}` }));
		})
	);

	const options = $derived([NONE, ...entries.map((entry) => entry.label)]);
	const current = $derived(
		parent
			? (entries.find((e) => e.kind === parent.kind && e.name === parent.name)?.label ?? NONE)
			: NONE
	);

	function label(kind: Parent['kind']): string {
		return kind[0].toUpperCase() + kind.slice(1);
	}

	function choose(value: string) {
		if (value === NONE) {
			onChange(null);
			return;
		}
		const entry = entries.find((e) => e.label === value);
		if (entry) onChange({ kind: entry.kind, name: entry.name });
	}
</script>

<SearchableSelect value={current} {options} {placeholder} onValueChange={choose} />
