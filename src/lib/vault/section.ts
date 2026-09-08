/**
 * Markdown section lookup.
 *
 * Task notes and daily notes both carry structure in their headings — `## Why`, `## Steps`,
 * `## Notes`, `## Quick ToDo` — and the app needs to read and edit inside one of them without
 * disturbing the others. A section runs from its heading to the next heading of equal or shallower
 * depth, which is what Obsidian means by a section too.
 */

export interface Section {
	/** Heading text with the leading #s and surrounding whitespace stripped. */
	title: string;
	/** Number of leading #s. */
	level: number;
	/** Offset of the `#` that opens the heading. */
	headingStart: number;
	/** Offset just past the heading line's newline — where the content starts. */
	contentStart: number;
	/** Offset just past the section's content. */
	contentEnd: number;
}

const HEADING = /^(#{1,6})\s+(.*)$/;

/** Every heading in the note, each with the range of content it owns. */
export function findSections(raw: string): Section[] {
	const lines = raw.split('\n');
	const headings: Array<Omit<Section, 'contentEnd'>> = [];

	let offset = 0;
	for (const line of lines) {
		const lineStart = offset;
		offset += line.length + 1;

		const match = HEADING.exec(line);
		if (!match) continue;

		headings.push({
			title: match[2].trim(),
			level: match[1].length,
			headingStart: lineStart,
			contentStart: Math.min(lineStart + line.length + 1, raw.length)
		});
	}

	return headings.map((heading, i) => {
		// The section ends at the next heading that is not nested beneath it.
		const next = headings.slice(i + 1).find((h) => h.level <= heading.level);
		return { ...heading, contentEnd: next ? next.headingStart : raw.length };
	});
}

/**
 * Find one section by title, case-insensitively.
 *
 * Titles are compared loosely because the vault is not perfectly consistent — the daily note
 * template writes `## Quick ToDo:` with a trailing colon, and a note edited by hand might not.
 */
export function findSection(raw: string, title: string): Section | undefined {
	const wanted = normalise(title);
	return findSections(raw).find((section) => normalise(section.title) === wanted);
}

function normalise(title: string): string {
	return title.trim().replace(/:$/, '').toLowerCase();
}

/**
 * Replace one section's content, leaving its heading and the rest of the note untouched.
 */
export function replaceSectionContent(raw: string, section: Section, content: string): string {
	return raw.slice(0, section.contentStart) + content + raw.slice(section.contentEnd);
}

/**
 * Append a section to the end of the note, with a blank line before it.
 *
 * Used when a note predates a template change and is missing a section the app wants to write to.
 */
export function appendSection(raw: string, title: string, level = 2, content = ''): string {
	const heading = `${'#'.repeat(level)} ${title}`;
	const separator = raw.endsWith('\n\n') ? '' : raw.endsWith('\n') ? '\n' : '\n\n';
	return `${raw}${separator}${heading}\n${content}`;
}
