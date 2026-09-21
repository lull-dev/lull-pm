import { describe, expect, it } from 'vitest';
import { categoryNames, hasCategory } from './categories';
import { parseNote } from './frontmatter';

/** Fixtures copied verbatim out of TrueFerret-Vault. */

const TASK = `---
categories:
  - "[[Tasks]]"
status: In Progress
---
body
`;

// Companies link through the category note's path, with an alias. Same category, different shape.
const COMPANY = `---
categories:
  - "[[Categories/Companies|Companies]]"
---
Website:
www.TrueFerret.com
`;

// A project whose status is a list, and whose org points at a company.
const PROJECT = `---
categories:
  - "[[Projects]]"
org:
  - "[[Ferret Media]]"
status:
  - Idea
---
`;

// Real note: no frontmatter whatsoever. Companies/lull-Software/lull.app/!lull.app.md
const NO_FRONTMATTER = `### Part of: [[lull]]

Website:
www.lull-app.com
`;

describe('categoryNames', () => {
	it('reads a plain link', () => {
		expect(categoryNames(parseNote(TASK))).toEqual(['Tasks']);
	});

	it('resolves a path + alias link to its basename, the way Obsidian does', () => {
		expect(categoryNames(parseNote(COMPANY))).toEqual(['Companies']);
	});

	it('returns nothing for a note with no frontmatter rather than guessing', () => {
		expect(categoryNames(parseNote(NO_FRONTMATTER))).toEqual([]);
	});

	it('returns nothing when the key is absent', () => {
		expect(categoryNames(parseNote('---\nstatus: Idea\n---\n'))).toEqual([]);
	});

	it('reads several categories in declaration order', () => {
		const note = parseNote('---\ncategories:\n  - "[[Projects]]"\n  - "[[Videos]]"\n---\n');
		expect(categoryNames(note)).toEqual(['Projects', 'Videos']);
	});
});

describe('hasCategory', () => {
	it('matches a plain link', () => {
		expect(hasCategory(parseNote(PROJECT), 'Projects')).toBe(true);
	});

	it('matches through an alias', () => {
		expect(hasCategory(parseNote(COMPANY), 'Companies')).toBe(true);
	});

	it('matches case-insensitively, as link resolution does', () => {
		expect(hasCategory(parseNote(TASK), 'tasks')).toBe(true);
	});

	it('does not match a different category', () => {
		expect(hasCategory(parseNote(TASK), 'Projects')).toBe(false);
	});
});
