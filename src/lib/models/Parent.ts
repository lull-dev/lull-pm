/**
 * What a task, project or goal is connected to — exactly one thing, never two.
 *
 *     A Project connects to a Bucket or a Company.
 *     A Task    connects to a Bucket or a Project.
 *     A Goal    connects to a Bucket or a Company.
 *
 * Never both. That rule is the reason this module exists: it is one rule, so it lives in one place
 * rather than being re-implemented in each service and each picker.
 *
 * On disk it is still two keys, because the vault's `.base` files already filter on them —
 * `Projects.base` does `org.contains(link("Ferret Media"))`, and rewriting every note to a single
 * `parent:` key would break every one of those views. So the union is a TypeScript idea and the
 * two keys are a vault fact, and `setParent` is what keeps them from disagreeing: it writes the key
 * it means and clears the other in the *same* edit, so the note is never on disk in a state the
 * rule forbids.
 *
 * All three keys hold a list of wikilinks, matching what `org:` and `projects:` already are and
 * what `.contains()` expects. lull-pm simply never writes more than one entry.
 */

import {
	getBoolean,
	getStringList,
	parseNote,
	setFrontmatterValues,
	type FrontmatterValue,
	type ParsedNote
} from '$lib/vault/frontmatter';
import { asWikilink, formatWikilink, sameTarget } from '$lib/vault/wikilink';

export type ParentKind = 'bucket' | 'company' | 'project';

export interface Parent {
	kind: ParentKind;
	/** The parent note's name, as Obsidian resolves the link — basename, no folders. */
	name: string;
}

/**
 * The frontmatter key each kind of connection lives under.
 *
 * `company` is `org:` because that is what the vault has always called it, and what it has always
 * held: real notes carry `org: "[[Schneider Electric]]"`, `"[[Ferret Media]]"`, `"[[Student
 * Events]]"` — companies, every one. The name stays; only lull-pm's reading of it was ever wrong.
 */
export const PARENT_KEY: Record<ParentKind, string> = {
	bucket: 'bucket',
	company: 'org',
	project: 'projects'
};

/**
 * Which kinds each note type may connect to, most specific first.
 *
 * Order is load-bearing: it is the tie-break when a note breaks the rule and carries both. A
 * project is more specific than the bucket it sits in, and a company more specific than a bucket,
 * so the narrower answer is the one shown.
 */
export const PARENT_KINDS = {
	task: ['project', 'bucket'],
	project: ['company', 'bucket'],
	goal: ['company', 'bucket']
} as const satisfies Record<string, readonly ParentKind[]>;

export type ParentedType = keyof typeof PARENT_KINDS;

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every parent link on the note, in specificity order. More than one means the note breaks the
 * rule; the UI surfaces that rather than lull-pm silently picking a winner and writing it back.
 */
export function parentsOn(note: ParsedNote, type: ParentedType): Parent[] {
	return PARENT_KINDS[type].flatMap((kind) =>
		linkedNames(note, kind).map((name) => ({ kind, name }))
	);
}

/** The note's parent: the most specific link it carries, or null when it carries none. */
export function readParent(note: ParsedNote, type: ParentedType): Parent | null {
	return parentsOn(note, type)[0] ?? null;
}

/**
 * How a note's links break the rule, or null when they do not.
 *
 * - `two-kinds` — connected to a bucket *and* a company/project. The "never both" rule.
 * - `too-many` — connected to two of the same kind. "Exactly one parent."
 */
export type ParentViolation = 'two-kinds' | 'too-many';

export function parentViolation(note: ParsedNote, type: ParentedType): ParentViolation | null {
	const parents = parentsOn(note, type);
	if (parents.length < 2) return null;
	return new Set(parents.map((parent) => parent.kind)).size > 1 ? 'two-kinds' : 'too-many';
}

function linkedNames(note: ParsedNote, kind: ParentKind): string[] {
	const key = PARENT_KEY[kind];

	// `bucket: true` is the retired flag from when a bucket was a property of a project rather than
	// a note of its own. It is a boolean, not a link, and reading it as a parent would invent a
	// bucket named "true". Phase 2 converts these; until then they are simply not parents.
	if (kind === 'bucket' && getBoolean(note, key) !== undefined) return [];

	return getStringList(note, key).map((value) => asWikilink(value).name);
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Connect a note to exactly one parent, or to none.
 *
 * Every key the type could use is settled in one `setFrontmatterValues` pass, so the rule holds at
 * every moment the file exists on disk — there is no window where a note is connected to both.
 *
 * A key that holds nothing is left absent rather than written as empty: setting a project's company
 * should not append a stray `bucket:` line to a note that never had one. And a task's `org:` is
 * never touched at all, because a task's parent is a bucket or a project — its company follows from
 * its project, and rewriting a property the user maintains by hand is not lull-pm's call.
 */
export function setParent(raw: string, type: ParentedType, parent: Parent | null): string {
	const kinds: readonly ParentKind[] = PARENT_KINDS[type];

	if (parent && !kinds.includes(parent.kind)) {
		throw new Error(`A ${type} cannot be connected to a ${parent.kind}.`);
	}
	if (parent && parent.name.trim() === '') {
		throw new Error('A parent needs a name.');
	}

	const note = parseNote(raw);
	const edits: Record<string, FrontmatterValue> = {};

	for (const kind of kinds) {
		const key = PARENT_KEY[kind];

		if (parent?.kind === kind) {
			// The note may already link to this target by path, or through an alias:
			// `org: "[[Companies/Taboen Gang/Taboen Gang|Taboen Gang]]"` and `"[[Notes/KdG]]"` are
			// both in the real vault. Those links already resolve exactly where they should, and
			// rewriting them as a bare `[[Taboen Gang]]` would throw away a path the user wrote on
			// purpose. Links are compared the way Obsidian resolves them — by basename — so an
			// unchanged parent leaves its bytes alone whatever shape they are in.
			const existing = getStringList(note, key);
			if (existing.length === 1 && sameTarget(existing[0], parent.name)) continue;

			edits[key] = [formatWikilink(parent.name.trim())];
		} else if (linkedNames(note, kind).length > 0) {
			edits[key] = null;
		}
	}

	return setFrontmatterValues(raw, edits);
}

/* -------------------------------------------------------------------------- */

/** Two parents are the same when they mean the same note. */
export function sameParent(a: Parent | null, b: Parent | null): boolean {
	if (a === null || b === null) return a === b;
	return a.kind === b.kind && a.name.toLowerCase() === b.name.toLowerCase();
}

/** How a parent should read in the UI: "Bucket", "Company", "Project". */
export function parentLabel(kind: ParentKind): string {
	return kind[0].toUpperCase() + kind.slice(1);
}
