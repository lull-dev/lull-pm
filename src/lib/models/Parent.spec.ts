import { describe, expect, it } from 'vitest';
import { parseNote } from '$lib/vault/frontmatter';
import {
	parentViolation,
	parentsOn,
	readParent,
	sameParent,
	setParent,
	type Parent
} from './Parent';

/** Fixtures in the shape the real vault writes them. */

const TASK = `---
categories:
  - "[[Tasks]]"
status: In Progress
priority: High
org:
  - "[[Schneider Electric]]"
projects:
due:
---

## Why
`;

const PROJECT = `---
categories:
  - "[[Projects]]"
org:
  - "[[Ferret Media]]"
clients:
status:
  - Idea
---

## Tasks
`;

const BARE_PROJECT = `---
categories:
  - "[[Projects]]"
---
`;

const BOTH =
	'---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Ferret Media]]"\n' +
	'bucket:\n  - "[[Personal]]"\n---\n';

const LEGACY_FLAG = '---\ncategories:\n  - "[[Projects]]"\nbucket: true\nstatus: Idea\n---\n';

const parent = (kind: Parent['kind'], name: string): Parent => ({ kind, name });

describe('readParent', () => {
	it('reads the project a task is connected to', () => {
		const note = parseNote(setParent(TASK, 'task', parent('project', 'Marketing Website')));
		expect(readParent(note, 'task')).toEqual({ kind: 'project', name: 'Marketing Website' });
	});

	it('reads org as the company a project belongs to', () => {
		expect(readParent(parseNote(PROJECT), 'project')).toEqual({
			kind: 'company',
			name: 'Ferret Media'
		});
	});

	it('does not read org on a task — a task connects to a bucket or a project', () => {
		expect(readParent(parseNote(TASK), 'task')).toBeNull();
	});

	it('is null when the note carries no connection at all', () => {
		expect(readParent(parseNote(BARE_PROJECT), 'project')).toBeNull();
	});

	it('is null for an empty key rather than a parent with an empty name', () => {
		const empty = '---\ncategories:\n  - "[[Projects]]"\norg:\n---\n';
		expect(readParent(parseNote(empty), 'project')).toBeNull();
	});

	it('ignores the retired bucket flag instead of inventing a bucket named "true"', () => {
		expect(readParent(parseNote(LEGACY_FLAG), 'project')).toBeNull();
	});

	it('prefers the more specific link when a note breaks the rule and carries both', () => {
		expect(readParent(parseNote(BOTH), 'project')).toEqual({
			kind: 'company',
			name: 'Ferret Media'
		});
	});

	it('resolves a parent through a path and alias link', () => {
		const aliased =
			'---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Companies/TrueFerret|TrueFerret]]"\n---\n';
		expect(readParent(parseNote(aliased), 'project')).toEqual({
			kind: 'company',
			name: 'TrueFerret'
		});
	});
});

describe('parentViolation', () => {
	it('is null for a note with one parent', () => {
		expect(parentViolation(parseNote(PROJECT), 'project')).toBeNull();
	});

	it('is null for a note with no parent', () => {
		expect(parentViolation(parseNote(BARE_PROJECT), 'project')).toBeNull();
	});

	it('reports a bucket and a company together', () => {
		expect(parentViolation(parseNote(BOTH), 'project')).toBe('two-kinds');
	});

	it('reports two of the same kind', () => {
		const two = '---\ncategories:\n  - "[[Tasks]]"\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n---\n';
		expect(parentViolation(parseNote(two), 'task')).toBe('too-many');
	});

	it('surfaces both links rather than hiding the one it did not pick', () => {
		expect(parentsOn(parseNote(BOTH), 'project')).toEqual([
			{ kind: 'company', name: 'Ferret Media' },
			{ kind: 'bucket', name: 'Personal' }
		]);
	});
});

describe('setParent', () => {
	it('writes the key and clears the other one in the same pass', () => {
		const next = setParent(PROJECT, 'project', parent('bucket', 'Personal'));
		const note = parseNote(next);

		expect(readParent(note, 'project')).toEqual({ kind: 'bucket', name: 'Personal' });
		expect(parentViolation(note, 'project')).toBeNull();
		expect(next).toContain('bucket:\n  - "[[Personal]]"');
		expect(next).toContain('org:\n');
		expect(next).not.toContain('Ferret Media');
	});

	it('writes a wikilink list, which is what .base .contains() filters on', () => {
		expect(setParent(BARE_PROJECT, 'project', parent('company', 'TrueFerret'))).toContain(
			'org:\n  - "[[TrueFerret]]"'
		);
	});

	it('never touches org on a task — its company follows from its project', () => {
		const next = setParent(TASK, 'task', parent('project', 'Marketing Website'));
		expect(next).toContain('org:\n  - "[[Schneider Electric]]"');
	});

	it('does not append a key the note never had', () => {
		const next = setParent(BARE_PROJECT, 'project', parent('company', 'TrueFerret'));
		expect(next).not.toContain('bucket:');
	});

	it('clears both keys when disconnected', () => {
		const next = setParent(PROJECT, 'project', null);
		expect(readParent(parseNote(next), 'project')).toBeNull();
		expect(next).not.toContain('Ferret Media');
	});

	it('changes nothing when disconnecting a note that has no parent', () => {
		expect(setParent(BARE_PROJECT, 'project', null)).toBe(BARE_PROJECT);
	});

	it('changes nothing when the parent already matches', () => {
		expect(setParent(PROJECT, 'project', parent('company', 'Ferret Media'))).toBe(PROJECT);
	});

	it('leaves the retired bucket flag for the migration to convert', () => {
		expect(setParent(LEGACY_FLAG, 'project', parent('company', 'TrueFerret'))).toContain(
			'bucket: true'
		);
	});

	it('repairs a note that breaks the rule, rather than leaving the loser behind', () => {
		const next = setParent(BOTH, 'project', parent('bucket', 'Personal'));
		expect(parentViolation(parseNote(next), 'project')).toBeNull();
	});

	it('refuses a connection the rule does not allow', () => {
		expect(() => setParent(TASK, 'task', parent('company', 'TrueFerret'))).toThrow(
			/task cannot be connected to a company/
		);
		expect(() => setParent(PROJECT, 'project', parent('project', 'Other'))).toThrow(
			/project cannot be connected to a project/
		);
	});

	it('refuses a nameless parent', () => {
		expect(() => setParent(PROJECT, 'project', parent('company', '  '))).toThrow(/needs a name/);
	});

	it('leaves every other property and the body byte-for-byte', () => {
		const next = setParent(PROJECT, 'project', parent('company', 'TrueFerret'));
		expect(next).toContain('clients:\n');
		expect(next).toContain('status:\n  - Idea');
		expect(next.slice(next.lastIndexOf('---') + 3)).toBe('\n\n## Tasks\n');
	});
});

describe('sameParent', () => {
	it('matches on kind and name, case-insensitively', () => {
		expect(sameParent(parent('company', 'TrueFerret'), parent('company', 'trueferret'))).toBe(true);
	});

	it('does not match across kinds', () => {
		expect(sameParent(parent('company', 'X'), parent('bucket', 'X'))).toBe(false);
	});

	it('treats two absent parents as the same', () => {
		expect(sameParent(null, null)).toBe(true);
		expect(sameParent(null, parent('bucket', 'X'))).toBe(false);
	});
});

describe('setParent and link shape', () => {
	// Both of these are real `org:` values from the vault.
	const PATH_AND_ALIAS =
		'---\ncategories:\n  - "[[Projects]]"\norg:\n' +
		'  - "[[Companies/Taboen Gang/Taboen Gang|Taboen Gang]]"\nstatus:\n  - Idea\n---\n';
	const PATH_ONLY = '---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Notes/KdG]]"\n---\n';

	it('resolves a path and alias link to the note it points at', () => {
		expect(readParent(parseNote(PATH_AND_ALIAS), 'project')).toEqual({
			kind: 'company',
			name: 'Taboen Gang'
		});
	});

	it('leaves a path-qualified link alone when the parent has not changed', () => {
		expect(setParent(PATH_AND_ALIAS, 'project', parent('company', 'Taboen Gang'))).toBe(
			PATH_AND_ALIAS
		);
		expect(setParent(PATH_ONLY, 'project', parent('company', 'KdG'))).toBe(PATH_ONLY);
	});

	it('still rewrites the link when the parent actually changes', () => {
		const next = setParent(PATH_AND_ALIAS, 'project', parent('company', 'Ferret Media'));
		expect(next).toContain('org:\n  - "[[Ferret Media]]"');
		expect(next).not.toContain('Taboen Gang');
	});

	it('clears a path-qualified link like any other', () => {
		expect(readParent(parseNote(setParent(PATH_ONLY, 'project', null)), 'project')).toBeNull();
	});
});
