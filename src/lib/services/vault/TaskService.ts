/**
 * Tasks, read and written as notes in `Tasks/`.
 *
 * Every mutation goes through `editNote`, which re-reads before writing and re-runs the edit against
 * fresh text if the note moved underneath it. That means every edit callback here must derive
 * whatever it needs (a checkbox, a section's bounds) from the `raw` text it is handed, never from a
 * value captured outside the callback — otherwise a retry would act on stale offsets.
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
	appendCheckbox,
	findCheckboxes,
	setCheckboxState,
	type Checkbox
} from '$lib/vault/checkbox';
import {
	getString,
	getStringList,
	parseNote,
	setFrontmatterValue,
	setFrontmatterValues,
	type FrontmatterValue
} from '$lib/vault/frontmatter';
import { appendSection, findSection, replaceSectionContent } from '$lib/vault/section';
import { applyTemplate, formatDate } from '$lib/vault/templater';
import { asWikilink, formatWikilink } from '$lib/vault/wikilink';
import { readLullConfig } from '$lib/vault/settings';
import {
	TASK_PRIORITIES,
	TASK_STATUSES,
	type Task,
	type TaskPriority,
	type TaskStatus
} from '$lib/models/Task';

export interface CreateTaskOptions {
	priority?: TaskPriority;
	org?: string[];
	projects?: string[];
	due?: string;
	doDate?: string;
	today?: Date;
}

export class TaskService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string
	) {}

	static async open(adapter: VaultAdapter): Promise<TaskService> {
		const config = await readLullConfig(adapter);
		return new TaskService(adapter, config.folders.tasks);
	}

	/* ---------------------------------------------------------------------- */
	/* Reading                                                                  */
	/* ---------------------------------------------------------------------- */

	async listTasks(): Promise<Task[]> {
		let files: VaultFile[];
		try {
			files = await this.adapter.list(this.folder, { recursive: true });
		} catch {
			return [];
		}

		const tasks = await Promise.all(
			files
				.filter((file) => !file.name.toLowerCase().includes('template'))
				.map((file) => this.readTask(file.path))
		);
		return tasks.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readTask(path: string): Promise<Task> {
		const raw = await this.adapter.read(path);
		return toTask(path, raw);
	}

	/* ---------------------------------------------------------------------- */
	/* Creating                                                                 */
	/* ---------------------------------------------------------------------- */

	async createTask(name: string, options: CreateTaskOptions = {}): Promise<Task> {
		if (name.trim() === '') throw new Error('A task needs a name.');

		const path = joinPath(this.folder, `${name}.md`);
		const today = options.today ?? new Date();

		const template = await this.readTemplate();
		let content = template
			? applyTemplate(template, { date: today, title: name })
			: blankTask(today);

		const edits: Record<string, FrontmatterValue> = {};
		if (options.priority) edits.priority = options.priority;
		if (options.org) edits.org = options.org.map((name) => formatWikilink(name));
		if (options.projects) edits.projects = options.projects.map((name) => formatWikilink(name));
		if (options.due) edits.due = options.due;
		if (options.doDate) edits.do = options.doDate;
		if (Object.keys(edits).length > 0) content = setFrontmatterValues(content, edits);

		await createNote(this.adapter, path, content);
		return this.readTask(path);
	}

	private async readTemplate(): Promise<string | null> {
		const path = 'Templates/Task Template.md';
		if (!(await this.adapter.exists(path))) return null;
		return this.adapter.read(path);
	}

	/* ---------------------------------------------------------------------- */
	/* Editing frontmatter                                                      */
	/* ---------------------------------------------------------------------- */

	/**
	 * Change status, keeping `done` consistent with it: set to today when moving to Done (unless
	 * already recorded), cleared when moving away from Done. Past history is not invented — a task
	 * already marked done keeps whatever date it already has.
	 */
	async setStatus(path: string, status: TaskStatus, today: Date = new Date()): Promise<Task> {
		await editNote(this.adapter, path, (raw) => {
			const note = parseNote(raw);
			const edits: Record<string, FrontmatterValue> = { status };
			if (status === 'Done') {
				if (!getString(note, 'done')) {
					edits.done = formatDate(today, { format: 'YYYY-MM-DD', offset: 0 });
				}
			} else {
				edits.done = null;
			}
			return setFrontmatterValues(raw, edits);
		});
		return this.readTask(path);
	}

	async setPriority(path: string, priority: TaskPriority): Promise<Task> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'priority', priority));
		return this.readTask(path);
	}

	async setDue(path: string, due: string | null): Promise<Task> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'due', due));
		return this.readTask(path);
	}

	async setDoDate(path: string, doDate: string | null): Promise<Task> {
		await editNote(this.adapter, path, (raw) => setFrontmatterValue(raw, 'do', doDate));
		return this.readTask(path);
	}

	async setOrg(path: string, org: string[]): Promise<Task> {
		await editNote(this.adapter, path, (raw) =>
			setFrontmatterValue(
				raw,
				'org',
				org.map((name) => formatWikilink(name))
			)
		);
		return this.readTask(path);
	}

	async setProjects(path: string, projects: string[]): Promise<Task> {
		await editNote(this.adapter, path, (raw) =>
			setFrontmatterValue(
				raw,
				'projects',
				projects.map((name) => formatWikilink(name))
			)
		);
		return this.readTask(path);
	}

	/* ---------------------------------------------------------------------- */
	/* Body sections                                                            */
	/* ---------------------------------------------------------------------- */

	async setWhy(path: string, text: string): Promise<Task> {
		return this.setSection(path, 'Why', text);
	}

	async setNotes(path: string, text: string): Promise<Task> {
		return this.setSection(path, 'Notes', text);
	}

	private async setSection(path: string, title: string, text: string): Promise<Task> {
		await editNote(this.adapter, path, (raw) => {
			const withSection = findSection(raw, title) ? raw : appendSection(raw, title);
			const section = findSection(withSection, title)!;
			const content = text.trim() === '' ? '\n' : `${text.trim()}\n`;
			return replaceSectionContent(withSection, section, content);
		});
		return this.readTask(path);
	}

	/* ---------------------------------------------------------------------- */
	/* Steps                                                                    */
	/* ---------------------------------------------------------------------- */

	async toggleStep(path: string, index: number): Promise<Task> {
		await editNote(this.adapter, path, (raw) => {
			const checkbox = stepsIn(raw)[index];
			if (!checkbox) return raw;
			return setCheckboxState(raw, checkbox, checkbox.state === 'x' ? ' ' : 'x');
		});
		return this.readTask(path);
	}

	async addStep(path: string, text: string): Promise<Task> {
		if (text.trim() === '') throw new Error('A step needs some text.');
		await editNote(this.adapter, path, (raw) => {
			const withSection = findSection(raw, 'Steps') ? raw : appendSection(raw, 'Steps');
			const section = findSection(withSection, 'Steps')!;
			return appendCheckbox(
				withSection,
				{ start: section.contentStart, end: section.contentEnd },
				text
			);
		});
		return this.readTask(path);
	}
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function toTask(path: string, raw: string): Task {
	const note = parseNote(raw);

	const status = asStatus(getString(note, 'status'));
	const priority = asPriority(getString(note, 'priority'));

	return {
		path,
		name: noteName(path),
		status,
		priority,
		org: getStringList(note, 'org').map((value) => asWikilink(value).name),
		projects: getStringList(note, 'projects').map((value) => asWikilink(value).name),
		due: getString(note, 'due') ?? null,
		doDate: getString(note, 'do') ?? null,
		created: getString(note, 'created') ?? null,
		done: getString(note, 'done') ?? null,
		why: sectionText(raw, 'Why'),
		steps: stepsIn(raw),
		notes: sectionText(raw, 'Notes')
	};
}

function stepsIn(raw: string): Checkbox[] {
	const section = findSection(raw, 'Steps');
	if (!section) return [];
	return findCheckboxes(raw, { start: section.contentStart, end: section.contentEnd });
}

function sectionText(raw: string, title: string): string {
	const section = findSection(raw, title);
	if (!section) return '';
	return raw.slice(section.contentStart, section.contentEnd).trim();
}

function asStatus(value: string | undefined): TaskStatus {
	return (TASK_STATUSES as readonly string[]).includes(value ?? '')
		? (value as TaskStatus)
		: 'Inbox';
}

function asPriority(value: string | undefined): TaskPriority {
	return (TASK_PRIORITIES as readonly string[]).includes(value ?? '')
		? (value as TaskPriority)
		: 'Medium';
}

function blankTask(today: Date): string {
	const created = formatDate(today, { format: 'YYYY-MM-DD', offset: 0 });
	return (
		'---\n' +
		'categories:\n' +
		'  - "[[Tasks]]"\n' +
		'status: Inbox\n' +
		'priority: Medium\n' +
		'org:\n' +
		'projects:\n' +
		'due:\n' +
		'do:\n' +
		`created: ${created}\n` +
		`date: "[[${created}]]"\n` +
		'done:\n' +
		'---\n\n' +
		'## Why\n\n' +
		'## Steps\n-  [ ] \n\n' +
		'## Notes\n'
	);
}
