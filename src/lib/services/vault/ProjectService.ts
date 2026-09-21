/**
 * Projects, read and written as notes in `Projects/`.
 *
 * Same discipline as `TaskService`: every mutation goes through `editNote`, which re-reads before
 * writing and re-runs the edit against fresh text if the note moved underneath it.
 */

import { createNote, editNote, joinPath, noteName, type VaultAdapter } from '$lib/vault/adapter';
import {
	getScalar,
	getString,
	parseNote,
	removeFrontmatterKey,
	setFrontmatterValue,
	setFrontmatterValues,
	type FrontmatterValue,
	type ParsedNote
} from '$lib/vault/frontmatter';
import type { VaultIndex } from '$lib/vault/notes';
import { applyTemplate, formatDate } from '$lib/vault/templater';
import { ProjectTypeService } from './ProjectTypeService';
import { readLullConfig } from '$lib/vault/settings';
import { parentViolation, readParent, setParent, type Parent } from '$lib/models/Parent';
import type { Project } from '$lib/models/Project';

export interface CreateProjectOptions {
	status?: string;
	/** What the project is connected to: a company or a bucket. */
	parent?: Parent | null;
	/**
	 * Which template to build the note from. Defaults to whatever Templater maps the destination
	 * folder to — the same template Obsidian would have used for a note created there.
	 */
	template?: string;
	/** Where to put it. Defaults to the configured projects folder. */
	folder?: string;
	today?: Date;
}

/** The category a project note claims. */
export const PROJECT_CATEGORY = 'Projects';

export class ProjectService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string,
		private readonly types: ProjectTypeService
	) {}

	static async open(adapter: VaultAdapter): Promise<ProjectService> {
		const config = await readLullConfig(adapter);
		return new ProjectService(
			adapter,
			config.folders.projects,
			await ProjectTypeService.open(adapter)
		);
	}

	/* ---------------------------------------------------------------------- */
	/* Reading                                                                  */
	/* ---------------------------------------------------------------------- */

	/**
	 * Every project in the vault, alphabetical.
	 *
	 * Found by `categories: [[Projects]]`, not by folder — which is how `Projects.base` finds them
	 * too, and the only way to see a project like `Companies/lull-Software/lull.app/!lull.app.md`
	 * that lives outside `Projects/` entirely. The folder is where *new* ones go, nothing more.
	 *
	 * Synchronous: the index already holds each note parsed.
	 */
	listProjects(index: VaultIndex): Project[] {
		return index
			.byCategory(PROJECT_CATEGORY)
			.map((note) => toProject(note.path, note.note, note.title))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readProject(path: string): Promise<Project> {
		return toProject(path, parseNote(await this.adapter.read(path)));
	}

	/* ---------------------------------------------------------------------- */
	/* Creating                                                                 */
	/* ---------------------------------------------------------------------- */

	async createProject(name: string, options: CreateProjectOptions = {}): Promise<Project> {
		if (name.trim() === '') throw new Error('A project needs a name.');

		const folder = options.folder ?? this.folder;
		const path = joinPath(folder, `${name}.md`);
		const today = options.today ?? new Date();

		const templatePath = options.template ?? this.types.templateFor(folder);
		const template = await this.readTemplate(templatePath);
		let content = template
			? applyTemplate(template, { date: today, title: name })
			: blankProject(today);

		// `statuses:` belongs to the template, not to the notes made from it. The project keeps its
		// `type:`, which is what lull-pm reads back to find the pipeline — copying the whole list
		// into every note would duplicate it and let the copies drift.
		content = removeFrontmatterKey(content, 'statuses');
		content = removeFrontmatterKey(content, 'terminal');

		const edits: Record<string, FrontmatterValue> = {};
		if (options.status) edits.status = options.status;
		if (Object.keys(edits).length > 0) content = setFrontmatterValues(content, edits);
		if (options.parent !== undefined) content = setParent(content, 'project', options.parent);

		await createNote(this.adapter, path, content);
		return this.readProject(path);
	}

	private async readTemplate(path: string | null): Promise<string | null> {
		const resolved = path ?? 'Templates/Project Template.md';
		if (!(await this.adapter.exists(resolved))) return null;
		return this.adapter.read(resolved);
	}

	/* ---------------------------------------------------------------------- */
	/* Editing                                                                  */
	/* ---------------------------------------------------------------------- */

	async setStatus(path: string, status: string): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'status', status));
		return this.readProject(path);
	}

	/**
	 * Connect the project to a company or a bucket — never both. See `TaskService.setParent`.
	 */
	async setParent(path: string, parent: Parent | null): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setParent(raw, 'project', parent));
		return this.readProject(path);
	}
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function toProject(path: string, note: ParsedNote, title?: string): Project {
	return {
		path,
		// `!Dark Vibrance.md` is titled "Dark Vibrance" — the bang is Obsidian's file-list sorting
		// device, not part of the name.
		name: title ?? noteName(path).replace(/^!/, ''),
		status: getScalar(note, 'status') ?? '',
		type: getString(note, 'type') ?? '',
		parent: readParent(note, 'project'),
		parentViolation: parentViolation(note, 'project'),
		created: getString(note, 'created') ?? null
	};
}

function blankProject(today: Date): string {
	const created = formatDate(today, { format: 'YYYY-MM-DD', offset: 0 });
	return (
		'---\n' +
		'categories:\n' +
		'  - "[[Projects]]"\n' +
		'org:\n' +
		'clients:\n' +
		'status:\n' +
		`created: ${created}\n` +
		`date: "[[${created}]]"\n` +
		'start:\n' +
		'end:\n' +
		'---\n\n' +
		'## Tasks\n'
	);
}
