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
	getString,
	getStringList,
	parseNote,
	setFrontmatterValue,
	setFrontmatterValues,
	type FrontmatterValue
} from '$lib/vault/frontmatter';
import { applyTemplate, formatDate } from '$lib/vault/templater';
import { asWikilink, formatWikilink } from '$lib/vault/wikilink';
import { readLullConfig } from '$lib/vault/settings';
import type { Project } from '$lib/models/Project';

export interface CreateProjectOptions {
	org?: string[];
	clients?: string[];
	status?: string;
	start?: string;
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
		if (options.org) edits.org = options.org.map((name) => formatWikilink(name));
		if (options.clients) edits.clients = options.clients.map((name) => formatWikilink(name));
		if (options.status) edits.status = options.status;
		if (options.start) edits.start = options.start;
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

	async setOrg(path: string, org: string[]): Promise<Project> {
		await editNote(this.adapter, path, (raw) =>
			setFrontmatterValue(
				raw,
				'org',
				org.map((name) => formatWikilink(name))
			)
		);
		return this.readProject(path);
	}

	async setClients(path: string, clients: string[]): Promise<Project> {
		await editNote(this.adapter, path, (raw) =>
			setFrontmatterValue(
				raw,
				'clients',
				clients.map((name) => formatWikilink(name))
			)
		);
		return this.readProject(path);
	}

	async setStart(path: string, start: string | null): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'start', start));
		return this.readProject(path);
	}

	async setEnd(path: string, end: string | null): Promise<Project> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'end', end));
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
		org: getStringList(note, 'org').map((value) => asWikilink(value).name),
		clients: getStringList(note, 'clients').map((value) => asWikilink(value).name),
		status: getString(note, 'status') ?? '',
		start: getString(note, 'start') ?? null,
		end: getString(note, 'end') ?? null,
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
