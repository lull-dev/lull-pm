/**
 * Projects, read and written as notes in `Projects/`.
 *
 * Same discipline as `TaskService`: every mutation goes through `editNote`, which re-reads before
 * writing and re-runs the edit against fresh text if the note moved underneath it.
 */

import {
	createNote,
	editNote,
	joinPath,
	noteName,
	type VaultAdapter,
	type VaultFile
} from '$lib/vault/adapter';
import {
	getBoolean,
	getString,
	parseNote,
	setFrontmatterValue,
	setFrontmatterValues,
	type FrontmatterValue
} from '$lib/vault/frontmatter';
import { applyTemplate, formatDate } from '$lib/vault/templater';
import { readLullConfig } from '$lib/vault/settings';
import type { Project } from '$lib/models/Project';

export interface CreateProjectOptions {
	status?: string;
	/** Defaults to `false` — a plain project rather than a bucket. */
	bucket?: boolean;
	today?: Date;
}

export class ProjectService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string
	) {}

	static async open(adapter: VaultAdapter): Promise<ProjectService> {
		const config = await readLullConfig(adapter);
		return new ProjectService(adapter, config.folders.projects);
	}

	/* ---------------------------------------------------------------------- */
	/* Reading                                                                  */
	/* ---------------------------------------------------------------------- */

	async listProjects(): Promise<Project[]> {
		let files: VaultFile[];
		try {
			files = await this.adapter.list(this.folder, { recursive: true });
		} catch {
			return [];
		}

		const projects = await Promise.all(
			files
				.filter((file) => !file.name.toLowerCase().includes('template'))
				.map((file) => this.readProject(file.path))
		);
		return projects.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readProject(path: string): Promise<Project> {
		const raw = await this.adapter.read(path);
		return toProject(path, raw);
	}

	/* ---------------------------------------------------------------------- */
	/* Creating                                                                 */
	/* ---------------------------------------------------------------------- */

	async createProject(name: string, options: CreateProjectOptions = {}): Promise<Project> {
		if (name.trim() === '') throw new Error('A project needs a name.');

		const path = joinPath(this.folder, `${name}.md`);
		const today = options.today ?? new Date();

		const template = await this.readTemplate();
		let content = template
			? applyTemplate(template, { date: today, title: name })
			: blankProject(today);

		const edits: Record<string, FrontmatterValue> = {};
		if (options.status) edits.status = options.status;
		if (options.bucket !== undefined) edits.bucket = options.bucket;
		if (Object.keys(edits).length > 0) content = setFrontmatterValues(content, edits);

		await createNote(this.adapter, path, content);
		return this.readProject(path);
	}

	private async readTemplate(): Promise<string | null> {
		const path = 'Templates/Project Template.md';
		if (!(await this.adapter.exists(path))) return null;
		return this.adapter.read(path);
	}

	/* ---------------------------------------------------------------------- */
	/* Editing                                                                  */
	/* ---------------------------------------------------------------------- */

	async setStatus(path: string, status: string): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'status', status));
		return this.readProject(path);
	}

	async setBucket(path: string, bucket: boolean): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'bucket', bucket));
		return this.readProject(path);
	}
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function toProject(path: string, raw: string): Project {
	const note = parseNote(raw);

	return {
		path,
		name: noteName(path),
		status: getString(note, 'status') ?? '',
		created: getString(note, 'created') ?? null,
		bucket: getBoolean(note, 'bucket') ?? false
	};
}

function blankProject(today: Date): string {
	const created = formatDate(today, { format: 'YYYY-MM-DD', offset: 0 });
	return (
		'---\n' +
		'categories:\n' +
		'  - "[[Projects]]"\n' +
		'bucket: false\n' +
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
