/**
 * A company is a note that says `categories: [[Companies]]` — an organisation a project or a goal
 * can belong to, and what the `org:` property has always pointed at.
 *
 * Not "a note in `Companies/`". Two of the real vault's eight live somewhere else entirely —
 * `Schneider Electric/Schneider Electric.md` and `References/Karel de Grote Hogeschool.md` — and
 * both are load-bearing: `Projects.base` filters on `org.contains(link("Schneider Electric"))`. A
 * folder scan would find six companies and quietly lose two.
 *
 * A company note sitting inside another company's folder is still a company. lull-pm does not
 * demote it to a sub-note on the strength of where it sits — the note says what it is.
 */
export interface Company {
	/** Vault-relative path. This is the company's identity. */
	path: string;
	/** Basename without `.md`, `!` stripped — what `org:` links to. */
	name: string;
	/** The folder this company owns, when it has one. Empty string when it sits at a root. */
	folder: string;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
