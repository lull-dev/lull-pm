/**
 * What kind of note this is.
 *
 * The vault answers that question with `categories:`, not with the folder a note sits in. Every
 * `.base` file in `Templates/Bases/` proves it — `Projects.base` opens with
 * `categories.contains(link("Projects"))`, and Tasks.base and Companies.base do the same. Folders
 * are organisation, not type: `Projects/TrueFerret (LLC)/` groups projects by company, while
 * `Companies/lull-Software/lull.app/!lull.app.md` is a project living under `Companies/`.
 *
 * So lull-pm reads the category, and treats folders only as the default place to put something new.
 *
 * Links appear in all three shapes `wikilink.ts` documents, and all three are in the real vault:
 *
 *     categories:
 *       - "[[Projects]]"                      Tasks, Projects
 *       - "[[Categories/Companies|Companies]]" Companies
 *
 * Both resolve to the name `Companies` / `Projects`, because Obsidian resolves links by basename.
 */

import { getStringList, type ParsedNote } from './frontmatter';
import { asWikilink } from './wikilink';

/** The category note is what a category *is*, so these are the names links resolve to. */
export type CategoryName = string;

/**
 * Every category a note claims, by basename, in declaration order.
 *
 * A note with no `categories:` is not an error — plenty of real notes have none, and
 * `Companies/lull-Software/lull.app/!lull.app.md` has no frontmatter at all. They are simply
 * uncategorised, and lull-pm leaves them alone rather than guessing from their folder.
 */
export function categoryNames(note: ParsedNote): CategoryName[] {
	return getStringList(note, 'categories').map((value) => asWikilink(value).name);
}

/** True when the note claims this category. Compared case-insensitively, as Obsidian resolves. */
export function hasCategory(note: ParsedNote, category: CategoryName): boolean {
	const wanted = category.toLowerCase();
	return categoryNames(note).some((name) => name.toLowerCase() === wanted);
}
