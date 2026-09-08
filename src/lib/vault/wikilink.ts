/**
 * Obsidian wikilinks.
 *
 * The vault writes links three ways and all of them appear in real notes:
 *   "[[Schneider Electric]]"              plain
 *   "[[Categories/Companies|Companies]]"  path + alias  (Companies/lull.md)
 *   "[[!Dynamic Shelving Utility]]"       leading ! marks a folder's index note
 *
 * Links resolve by basename across folders, so `name` is what identity comparisons should use.
 */

export interface Wikilink {
	/** Everything before the alias: may include folders and a #heading. */
	target: string;
	/** The display text after `|`, when present. */
	alias?: string;
	/** Basename with no folders, no #heading, no extension — how Obsidian resolves the link. */
	name: string;
	/** Heading or block reference after `#`, when present. */
	heading?: string;
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;

/** Parse a single `[[...]]` string. Returns undefined for anything that is not one link. */
export function parseWikilink(text: string): Wikilink | undefined {
	const trimmed = text.trim();
	const match = /^\[\[([^\]]+)\]\]$/.exec(trimmed);
	if (!match) return undefined;
	return fromInner(match[1]);
}

/** Every wikilink in a block of text, in order. */
export function parseWikilinks(text: string): Wikilink[] {
	return [...text.matchAll(WIKILINK)].map((m) => fromInner(m[1]));
}

function fromInner(inner: string): Wikilink {
	const pipe = inner.indexOf('|');
	const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
	const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim();

	const hash = target.indexOf('#');
	const path = hash === -1 ? target : target.slice(0, hash);
	const heading = hash === -1 ? undefined : target.slice(hash + 1);

	const slash = path.lastIndexOf('/');
	const base = slash === -1 ? path : path.slice(slash + 1);
	const name = base.replace(/\.md$/i, '');

	return { target, alias, name, heading };
}

/** Render a link the way the vault writes them. */
export function formatWikilink(name: string, alias?: string): string {
	return alias ? `[[${name}|${alias}]]` : `[[${name}]]`;
}

/**
 * The label a link should show: its alias, else its basename.
 */
export function displayName(link: Wikilink): string {
	return link.alias ?? link.name;
}

/** Compare two link-ish strings the way Obsidian would: by basename, case-insensitively. */
export function sameTarget(a: string, b: string): boolean {
	const norm = (value: string) => {
		const link = parseWikilink(value);
		const name = link ? link.name : value.trim().replace(/\.md$/i, '');
		return name.toLowerCase();
	};
	return norm(a) === norm(b);
}

/**
 * Turn a stored property value into a link, tolerating both `[[X]]` and a bare `X`.
 *
 * Frontmatter link lists are supposed to be quoted wikilinks, but hand-edited notes are not always
 * consistent, and a bare name is unambiguous enough to accept.
 */
export function asWikilink(value: string): Wikilink {
	return parseWikilink(value) ?? fromInner(value.trim());
}
