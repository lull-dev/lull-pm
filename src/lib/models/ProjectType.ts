/**
 * A kind of project, and the pipeline it moves through.
 *
 * A content project goes Idea → Scripting → Filming → Editing → Review → Published. A development
 * project goes Idea → In Progress → Done. Both are projects; neither should be forced into the
 * other's statuses.
 *
 * **A type is a template note.** Templater already decides which template a new note in a given
 * folder gets — the vault has `enable_folder_templates: true` and maps `Projects → Templates/Project
 * Template.md`, `.../Videos → Templates/Youtube Video Template.md`. That mapping is a project-type
 * system in everything but name, so lull-pm reads it rather than keeping a second, divergent list
 * that would drift from the one the user actually edits.
 *
 * The template declares its own pipeline in frontmatter:
 *
 *     ---
 *     categories:
 *       - "[[Projects]]"
 *     type: Content
 *     statuses: [Idea, Scripting, Filming, Editing, Review, Published]
 *     status: Idea
 *     ---
 *
 * `type:` is ordinary frontmatter and is copied into every project made from the template — that is
 * the tag lull-pm reads back to know which pipeline a project is on. `statuses:` is *stripped* from
 * the created note, so each project carries its type rather than a duplicated copy of the list.
 */

/**
 * What a status means to a view that does not know this type's vocabulary.
 *
 * The Today page has no idea what "Filming" is, and should not have to. Every status gets one of
 * these so mixed lists, done-detection and rollup counts keep working across types.
 *
 * Derived from position rather than declared: a pipeline is ordered, so the first status is where
 * things start and the last is where they end. One optional `terminal:` key overrides the ending
 * when a type has more than one way to finish.
 */
export type Phase = 'idea' | 'active' | 'done';

export interface ProjectType {
	/** The `type:` value written into project notes made from this template. */
	name: string;
	/** Vault-relative path of the template note this type is defined by. */
	template: string;
	/** The ordered pipeline. Never empty — a type with no `statuses:` falls back to the default. */
	statuses: string[];
	/** Statuses that mean finished. Defaults to the last one in the pipeline. */
	terminal: string[];
	/** Folders Templater maps to this template, for choosing where a new project goes. */
	folders: string[];
}

/**
 * The pipeline the vault has actually used up to now: `Projects.base` filters on "In Progress" and
 * "Idea", and those three are the only status values across its 102 project notes.
 */
export const DEFAULT_STATUSES = ['Idea', 'In Progress', 'On Hold', 'Done'] as const;

/** The type a project with no `type:` is on. Not written to any note — just what lull-pm assumes. */
export function defaultType(template = ''): ProjectType {
	return {
		name: '',
		template,
		statuses: [...DEFAULT_STATUSES],
		terminal: ['Done'],
		folders: []
	};
}

/** The type a project is on, or the default when it names one nothing defines. */
export function typeFor(typeName: string, types: ProjectType[]): ProjectType {
	if (typeName === '') return defaultType();
	const wanted = typeName.toLowerCase();
	return types.find((type) => type.name.toLowerCase() === wanted) ?? defaultType();
}

/**
 * The statuses to offer for a project.
 *
 * A status the note already holds is included even when the pipeline does not list it — the note is
 * the authority on what it says, and dropping its current status from the picker would make the UI
 * quietly lie about where the project is.
 */
export function statusesFor(status: string, type: ProjectType): string[] {
	if (status === '' || type.statuses.some((s) => s.toLowerCase() === status.toLowerCase())) {
		return type.statuses;
	}
	return [...type.statuses, status];
}

export function phaseOf(status: string, type: ProjectType): Phase {
	if (status === '') return 'idea';
	const lower = status.toLowerCase();

	if (type.terminal.some((s) => s.toLowerCase() === lower)) return 'done';
	return type.statuses.findIndex((s) => s.toLowerCase() === lower) === 0 ? 'idea' : 'active';
}

export function isDone(status: string, type: ProjectType): boolean {
	return phaseOf(status, type) === 'done';
}
