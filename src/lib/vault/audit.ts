/**
 * What lull-pm cannot make sense of — reported, never repaired.
 *
 * The vault belongs to the user. Notes are written by hand, over years, in whatever shape made
 * sense at the time, and lull-pm is a lens on that — not an authority over it. So nothing in this
 * module writes. It reads the vault, says plainly what it could not place and why, and leaves every
 * decision where it belongs.
 *
 * That is a deliberate limit, not a missing feature. A sweep that "tidied" 558 notes into lull-pm's
 * preferred shape would be the single most destructive thing this app could do, and it would do it
 * silently, across files no one asked it to touch. An overview costs one screen and loses nothing.
 *
 * lull-pm still writes — a status change, a new task, a parent the user picked. The difference is
 * that every one of those is a thing the user just asked for, on the note they were looking at.
 */

import { parentsOn, parentViolation, type ParentedType } from '$lib/models/Parent';
import { getBoolean } from './frontmatter';
import type { IndexedNote, VaultIndex } from './notes';

export type FindingKind =
	| 'unparseable-frontmatter'
	| 'two-kinds'
	| 'too-many-parents'
	| 'uncategorised'
	| 'legacy-bucket-flag';

/**
 * How much a finding matters.
 *
 * - `blocking` — lull-pm will refuse to write this note at all until it is fixed.
 * - `notice` — lull-pm works fine, but the note is probably not saying what the user meant.
 */
export type Severity = 'blocking' | 'notice';

export interface Finding {
	kind: FindingKind;
	severity: Severity;
	/** Vault-relative path of the note. Clickable through to Obsidian. */
	path: string;
	/** The note's title, `!` stripped. */
	title: string;
	/** What lull-pm sees, in the user's terms. */
	detail: string;
	/** What they might do about it — phrased as a suggestion, because it is theirs to decide. */
	suggestion: string;
}

export interface AuditOptions {
	/**
	 * The folders lull-pm reads its note *types* from — `Projects`, `Tasks`, `Companies`, `Goals`,
	 * `Categories/Buckets`.
	 *
	 * The inbox folder is deliberately not one of these. `_Inbox Notes/` is where Obsidian drops a
	 * new note before it is anything in particular, so having no category there is the normal state,
	 * not a problem to report.
	 */
	typedFolders: string[];
}

/** The categories lull-pm understands, and the parent rule each one follows. */
const TYPED_CATEGORIES: { category: string; type: ParentedType }[] = [
	{ category: 'Projects', type: 'project' },
	{ category: 'Tasks', type: 'task' },
	{ category: 'Goals', type: 'goal' }
];

export function auditVault(index: VaultIndex, options: AuditOptions): Finding[] {
	const findings: Finding[] = [];

	for (const note of index.all) {
		// A note whose YAML does not parse is the only thing here that actually stops lull-pm: it
		// will read the note, show it, and refuse every write to it until the YAML is valid.
		if (note.note.hasFrontmatter && note.note.errors.length > 0) {
			findings.push({
				kind: 'unparseable-frontmatter',
				severity: 'blocking',
				path: note.path,
				title: note.title,
				detail: `Its frontmatter does not parse: ${note.note.errors[0]}`,
				suggestion: 'lull-pm will show this note but refuse to change it. Fix the YAML in Obsidian.'
			});
			continue;
		}

		for (const { category, type } of TYPED_CATEGORIES) {
			if (!claims(note, category)) continue;

			const violation = parentViolation(note.note, type);
			if (violation === 'two-kinds') {
				findings.push({
					kind: 'two-kinds',
					severity: 'notice',
					path: note.path,
					title: note.title,
					detail: connectionSummary(note, type),
					suggestion: `A ${type} connects to one thing or the other, never both. lull-pm shows the more specific one and leaves the note alone.`
				});
			} else if (violation === 'too-many') {
				findings.push({
					kind: 'too-many-parents',
					severity: 'notice',
					path: note.path,
					title: note.title,
					detail: connectionSummary(note, type),
					suggestion: `A ${type} connects to exactly one thing. lull-pm shows the first and leaves the note alone.`
				});
			}
		}

		// The retired flag from when a bucket was a property of a project rather than a note.
		if (claims(note, 'Projects') && getBoolean(note.note, 'bucket') !== undefined) {
			findings.push({
				kind: 'legacy-bucket-flag',
				severity: 'notice',
				path: note.path,
				title: note.title,
				detail: 'It carries `bucket: true`, from when a bucket was a flag on a project.',
				suggestion:
					'Buckets are notes in Categories/Buckets/ now. This flag does nothing; remove it when convenient.'
			});
		}

		if (note.categories.length === 0) {
			const reason = whyItLooksLikeOurs(note, index, options.typedFolders);
			if (reason) {
				findings.push({
					kind: 'uncategorised',
					severity: 'notice',
					path: note.path,
					title: note.title,
					detail: reason,
					suggestion:
						'lull-pm finds notes by `categories:`, so it cannot see this one. Add the category in Obsidian if it should show up.'
				});
			}
		}
	}

	return findings.sort(bySeverityThenPath);
}

/** A count per kind, for the overview's summary line. */
export function countByKind(findings: Finding[]): Record<FindingKind, number> {
	const counts = {
		'unparseable-frontmatter': 0,
		'two-kinds': 0,
		'too-many-parents': 0,
		uncategorised: 0,
		'legacy-bucket-flag': 0
	} satisfies Record<FindingKind, number>;

	for (const finding of findings) counts[finding.kind]++;
	return counts;
}

/* -------------------------------------------------------------------------- */

function claims(note: IndexedNote, category: string): boolean {
	const wanted = category.toLowerCase();
	return note.categories.some((name) => name.toLowerCase() === wanted);
}

/**
 * Why an uncategorised note looks like one lull-pm should have been able to see — or null when it
 * does not, which is almost always.
 *
 * The vault has 558 uncategorised notes and nearly all of them are ordinary writing with no
 * business on this page. Two signals survive that filter, and both are narrow on purpose:
 *
 * - it sits **directly in** a typed folder, where every neighbour is a project or a task, or
 * - it is the **main note of its own folder** inside one of those trees — the `!` marker, or a
 *   name matching its folder. `Companies/lull-Software/lull.app/!lull.app.md` is the case that
 *   matters: plainly a project, invisible to lull-pm, and not something to fix behind the user.
 *
 * A *sub-note* is explicitly not a finding. `Projects/Archived/SA Project/Feedback Sprint 1 SA.md`
 * sits under `!SA Project.md` and is supposed to carry no category — flagging all 70-odd of those
 * would bury the two findings that matter.
 */
function whyItLooksLikeOurs(
	note: IndexedNote,
	index: VaultIndex,
	typedFolders: string[]
): string | null {
	const root = typedFolders.find(
		(folder) => folder !== '' && (note.folder === folder || note.folder.startsWith(`${folder}/`))
	);
	if (!root) return null;

	if (note.folder === root) return `It sits directly in ${root}/ but claims no category.`;
	if (isFolderMainNote(note, index)) {
		return `It is the main note of ${note.folder}/ but claims no category.`;
	}
	return null;
}

/**
 * Whether the note is what its folder is named after.
 *
 * Deliberately stricter than `notes.ts`'s `mainNoteScore`: the "only note in the folder" signal is
 * left out here, because a lone uncategorised note in some subfolder is not evidence of anything.
 * Only the two deliberate markers count — the bang, and a name matching the folder.
 */
function isFolderMainNote(note: IndexedNote, index: VaultIndex): boolean {
	if (note.name.startsWith('!')) return true;

	const folderName = note.folder.slice(note.folder.lastIndexOf('/') + 1).toLowerCase();
	const title = note.title.toLowerCase();
	if (folderName !== title && !folderName.startsWith(`${title} `)) return false;

	// A name match only means "main note" if the folder holds more than this one note.
	return index.all.some((other) => other.folder === note.folder && other.path !== note.path);
}

/** The connections the note actually carries, named, so the user can see what to choose between. */
function connectionSummary(note: IndexedNote, type: ParentedType): string {
	const links = parentsOn(note.note, type).map((parent) => `${parent.kind} “${parent.name}”`);
	return `It is connected to ${links.join(' and ')}.`;
}

const SEVERITY_ORDER: Record<Severity, number> = { blocking: 0, notice: 1 };

function bySeverityThenPath(a: Finding, b: Finding): number {
	const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
	return bySeverity !== 0 ? bySeverity : a.path.localeCompare(b.path);
}
