/**
 * Discovering project types from the vault's own templates.
 *
 * See `models/ProjectType.ts` for why a type *is* a template note. This reads them: every note in
 * Templater's configured templates folder that claims `categories: [[Projects]]` is a project
 * type, named by its `type:` property and carrying its pipeline in `statuses:`.
 *
 * Read-only. lull-pm never writes a template — those are the user's, edited in Obsidian, expanded
 * by Templater. It only reads what is there, and falls back to a sane default when nothing is.
 */

import { joinPath, noteName, type VaultAdapter } from '$lib/vault/adapter';
import { getString, getStringList, parseNote } from '$lib/vault/frontmatter';
import { hasCategory } from '$lib/vault/categories';
import {
	readTemplaterSettings,
	templateForFolder,
	type TemplaterSettings
} from '$lib/vault/settings';
import { defaultType, DEFAULT_STATUSES, type ProjectType } from '$lib/models/ProjectType';
import { PROJECT_CATEGORY } from './ProjectService';

/** Where lull-pm looks when Templater is not installed or names no folder. */
const FALLBACK_TEMPLATES_FOLDER = 'Templates';
const FALLBACK_PROJECT_TEMPLATE = 'Templates/Project Template.md';

export class ProjectTypeService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly templater: TemplaterSettings
	) {}

	static async open(adapter: VaultAdapter): Promise<ProjectTypeService> {
		return new ProjectTypeService(adapter, await readTemplaterSettings(adapter));
	}

	/**
	 * Every project type the vault defines, alphabetical, with the unnamed default first.
	 *
	 * A template with no `type:` still counts — it is the vault's plain Project Template, and it
	 * becomes the default type rather than being skipped.
	 */
	async listTypes(): Promise<ProjectType[]> {
		const folder = this.templater.templatesFolder ?? FALLBACK_TEMPLATES_FOLDER;

		let files;
		try {
			files = await this.adapter.list(folder, { recursive: true });
		} catch {
			return [defaultType(FALLBACK_PROJECT_TEMPLATE)];
		}

		const types: ProjectType[] = [];
		for (const file of files) {
			const note = parseNote(await this.adapter.read(file.path));
			if (!hasCategory(note, PROJECT_CATEGORY)) continue;

			const statuses = getStringList(note, 'statuses');
			const terminal = getStringList(note, 'terminal');

			types.push({
				// A template with no `type:` is the plain one; its name is the empty string, the same
				// as a project note that declares no type. They meet in the middle.
				name: getString(note, 'type') ?? '',
				template: file.path,
				statuses: statuses.length > 0 ? statuses : [...DEFAULT_STATUSES],
				terminal: terminal.length > 0 ? terminal : lastOf(statuses),
				folders: this.foldersMappedTo(file.path)
			});
		}

		if (types.length === 0) return [defaultType(FALLBACK_PROJECT_TEMPLATE)];

		return types.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * The template a new project in `folder` should be made from.
	 *
	 * Follows Templater's own resolution — most specific folder wins, `/` is the catch-all — so a
	 * note lull-pm creates lands on the same template Obsidian would have used.
	 */
	templateFor(folder: string): string | null {
		return templateForFolder(this.templater, folder) ?? null;
	}

	/** The template that defines a named type, for opening it in Obsidian. */
	templateOf(typeName: string, types: ProjectType[]): string | null {
		const wanted = typeName.toLowerCase();
		return types.find((type) => type.name.toLowerCase() === wanted)?.template ?? null;
	}

	private foldersMappedTo(template: string): string[] {
		return this.templater.folderTemplates
			.filter((entry) => entry.template === template)
			.map((entry) => entry.folder);
	}
}

/** The last status in a pipeline, as the default meaning of "finished". */
function lastOf(statuses: string[]): string[] {
	if (statuses.length === 0) return ['Done'];
	return [statuses[statuses.length - 1]];
}

/** Re-exported so callers can name a template without reaching into this module's constants. */
export { FALLBACK_PROJECT_TEMPLATE, joinPath, noteName };
