/**
 * Goals, read and written as notes claiming `categories: [[Goals]]`.
 *
 * Same discipline as the other services. lull-pm creates the `Goals/` folder when it writes the
 * first goal, because it has to put the note somewhere; it does not create `Categories/Goals.md`
 * (the vault already has one) or a `Goals.base`, and it will not write a `Templates/Goal
 * Template.md`. Those are the user's.
 */

import { createNote, editNote, joinPath, noteName, type VaultAdapter } from '$lib/vault/adapter';
import {
	getScalar,
	getString,
	parseNote,
	setScalarValue,
	type ParsedNote
} from '$lib/vault/frontmatter';
import type { VaultIndex } from '$lib/vault/notes';
import { readLullConfig } from '$lib/vault/settings';
import { formatDate } from '$lib/vault/templater';
import { formatWikilink } from '$lib/vault/wikilink';
import { parentViolation, readParent, setParent, type Parent } from '$lib/models/Parent';
import type { Goal } from '$lib/models/Goal';

/** The category a goal note claims. */
export const GOAL_CATEGORY = 'Goals';

export interface CreateGoalOptions {
	status?: string;
	/** What the goal is connected to: a company or a bucket. */
	parent?: Parent | null;
	today?: Date;
}

export class GoalService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string
	) {}

	static async open(adapter: VaultAdapter): Promise<GoalService> {
		const config = await readLullConfig(adapter);
		return new GoalService(adapter, config.folders.goals);
	}

	/** Every goal in the vault, alphabetical. */
	listGoals(index: VaultIndex): Goal[] {
		return index
			.byCategory(GOAL_CATEGORY)
			.map((note) => toGoal(note.path, note.note, note.title))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readGoal(path: string): Promise<Goal> {
		return toGoal(path, parseNote(await this.adapter.read(path)));
	}

	async createGoal(name: string, options: CreateGoalOptions = {}): Promise<Goal> {
		const trimmed = name.trim();
		if (trimmed === '') throw new Error('A goal needs a name.');

		const path = joinPath(this.folder, `${trimmed}.md`);
		const created = formatDate(options.today ?? new Date(), { format: 'YYYY-MM-DD', offset: 0 });

		let content =
			'---\n' +
			'categories:\n' +
			`  - "${formatWikilink(GOAL_CATEGORY)}"\n` +
			`status: ${options.status ?? ''}\n` +
			`created: ${created}\n` +
			'---\n';

		if (options.parent !== undefined) content = setParent(content, 'goal', options.parent);

		await createNote(this.adapter, path, content);
		return this.readGoal(path);
	}

	async setStatus(path: string, status: string): Promise<Goal> {
		await editNote(this.adapter, path, (raw) => setScalarValue(raw, 'status', status || null));
		return this.readGoal(path);
	}

	/** Connect the goal to a company or a bucket — never both. See `TaskService.setParent`. */
	async setParent(path: string, parent: Parent | null): Promise<Goal> {
		await editNote(this.adapter, path, (raw) => setParent(raw, 'goal', parent));
		return this.readGoal(path);
	}
}

/* -------------------------------------------------------------------------- */

function toGoal(path: string, note: ParsedNote, title?: string): Goal {
	return {
		path,
		name: title ?? noteName(path).replace(/^!/, ''),
		status: getScalar(note, 'status') ?? '',
		parent: readParent(note, 'goal'),
		parentViolation: parentViolation(note, 'goal'),
		created: getString(note, 'created') ?? null
	};
}
