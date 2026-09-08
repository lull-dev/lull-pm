import { describe, expect, it } from 'vitest';
import {
	getBoolean,
	getString,
	getStringList,
	keys,
	parseNote,
	removeFrontmatterKey,
	renameFrontmatterKey,
	setFrontmatterValue,
	setFrontmatterValues
} from './frontmatter';

/**
 * Fixtures are copied verbatim out of TrueFerret-Vault, double spaces and all. If a change breaks
 * one of these, it breaks real notes.
 */

const DAILY_NOTE = `---
categories:
  - "[[Daily Notes]]"
Wake up Before 8u: true
Make Bed: true
Allergy Meds: false
Eat Breakfast: true
Run/Workout: false
Create: false
Shower: false
Brush Teeth: false
Prep Clothes: false
Just Don't: true
created: 2026-06-09
---

## Quick ToDo:
-  [ ]





`;

const TASK_NOTE = `---
categories:
  - "[[Tasks]]"
status: In Progress
priority: High
org:
  - "[[Schneider Electric]]"
projects:
due:
created: 2026-08-14
done:
---

## Why
Needed for the CP migration work, and it feeds into Robby's plan.

## Steps
-  [ ] Draft the migration plan
-  [ ] Add to Robby's plan

## Notes
Source: [[TODOs Werk]]
`;

const ALIAS_LINK_NOTE = `---
categories:
  - "[[Categories/Companies|Companies]]"
---

[[!lull-Extension]]
`;

describe('parseNote', () => {
	it('splits a note without losing a byte', () => {
		const note = parseNote(DAILY_NOTE);
		expect(note.hasFrontmatter).toBe(true);
		expect(note.raw.slice(0, note.yamlStart) + note.yaml + note.raw.slice(note.yamlEnd)).toBe(
			DAILY_NOTE
		);
		expect(note.body).toBe(DAILY_NOTE.slice(note.bodyStart));
	});

	it('treats a note with no frontmatter as all body', () => {
		const raw = '# Just a heading\n\nsome text\n';
		const note = parseNote(raw);
		expect(note.hasFrontmatter).toBe(false);
		expect(note.body).toBe(raw);
	});

	it('ignores a --- that is not the very first line', () => {
		const note = parseNote('text\n---\nnot: frontmatter\n---\n');
		expect(note.hasFrontmatter).toBe(false);
	});

	it('reads keys in declaration order', () => {
		expect(keys(parseNote(TASK_NOTE))).toEqual([
			'categories',
			'status',
			'priority',
			'org',
			'projects',
			'due',
			'created',
			'done'
		]);
	});
});

describe('reading', () => {
	it('reads habit booleans, including keys with spaces, slashes and apostrophes', () => {
		const note = parseNote(DAILY_NOTE);
		expect(getBoolean(note, 'Make Bed')).toBe(true);
		expect(getBoolean(note, 'Allergy Meds')).toBe(false);
		expect(getBoolean(note, 'Run/Workout')).toBe(false);
		expect(getBoolean(note, 'Wake up Before 8u')).toBe(true);
		expect(getBoolean(note, "Just Don't")).toBe(true);
	});

	it('keeps dates as strings rather than Date objects', () => {
		const created = getString(parseNote(TASK_NOTE), 'created');
		expect(created).toBe('2026-08-14');
		expect(typeof created).toBe('string');
	});

	it('reads an empty property as absent, not as an empty string', () => {
		const note = parseNote(TASK_NOTE);
		expect(getString(note, 'due')).toBeUndefined();
		expect(getStringList(note, 'projects')).toEqual([]);
	});

	it('unwraps quoted wikilinks in a list', () => {
		expect(getStringList(parseNote(TASK_NOTE), 'org')).toEqual(['[[Schneider Electric]]']);
		expect(getStringList(parseNote(ALIAS_LINK_NOTE), 'categories')).toEqual([
			'[[Categories/Companies|Companies]]'
		]);
	});

	it('reads a scalar as a one-element list', () => {
		// `status` is a scalar on tasks but a list on projects; callers should not have to care.
		expect(getStringList(parseNote(TASK_NOTE), 'status')).toEqual(['In Progress']);
	});
});

describe('setFrontmatterValue', () => {
	it('changes only the bytes of the edited key', () => {
		const next = setFrontmatterValue(DAILY_NOTE, 'Make Bed', false);
		expect(next).toBe(DAILY_NOTE.replace('Make Bed: true', 'Make Bed: false'));
	});

	it('leaves the body completely untouched', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'status', 'Done');
		expect(parseNote(next).body).toBe(parseNote(TASK_NOTE).body);
	});

	it('is a no-op in text terms when the value is unchanged', () => {
		expect(setFrontmatterValue(DAILY_NOTE, 'Make Bed', true)).toBe(DAILY_NOTE);
	});

	/**
	 * Real notes write values in ways we would not, and re-serialising them would produce a diff
	 * the user never asked for. Setting a property to what it already means must therefore leave the
	 * text alone, whatever style that text is in.
	 */
	it('preserves quoting the note did not strictly need', () => {
		const clipping = '---\ntitle: "How is this Website so fast!?"\n---\nbody\n';
		expect(setFrontmatterValue(clipping, 'title', 'How is this Website so fast!?')).toBe(clipping);
	});

	it('preserves a quoted URL rather than unquoting it', () => {
		const clipping = '---\nsource: "https://www.youtube.com/watch?v=-Ln"\n---\nbody\n';
		expect(setFrontmatterValue(clipping, 'source', 'https://www.youtube.com/watch?v=-Ln')).toBe(
			clipping
		);
	});

	it('does not tidy away a stray empty list item', () => {
		const messy = '---\ncategories:\n  - "[[Clippings]]"\n  -\n---\nbody\n';
		expect(setFrontmatterValue(messy, 'categories', ['[[Clippings]]'])).toBe(messy);
	});

	it('leaves a scalar as a scalar when set to the same one-element value', () => {
		// Task `status` is a scalar and project `status` is a list, deliberately. Setting a task's
		// status must not quietly convert it into a list.
		expect(setFrontmatterValue(TASK_NOTE, 'status', ['In Progress'])).toBe(TASK_NOTE);
	});

	it('still writes when the value genuinely differs', () => {
		const clipping = '---\ntitle: "Old title"\n---\nbody\n';
		expect(setFrontmatterValue(clipping, 'title', 'New title')).toContain('title: New title');
	});

	it('fills in a key that exists but has no value', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'due', '2026-08-22');
		expect(next).toBe(TASK_NOTE.replace('due:\n', 'due: 2026-08-22\n'));
	});

	it('appends an unknown key at the end of the block, keeping existing order', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'blocked_by', ['[[Some Task]]']);
		expect(keys(parseNote(next))).toEqual([...keys(parseNote(TASK_NOTE)), 'blocked_by']);
		expect(next).toContain('blocked_by:\n  - "[[Some Task]]"');
	});

	it('writes link lists in the vault style: two-space indent, quoted', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'org', [
			'[[Schneider Electric]]',
			'[[Ferret Media]]'
		]);
		expect(next).toContain('org:\n  - "[[Schneider Electric]]"\n  - "[[Ferret Media]]"\n');
	});

	it('collapses a list to a bare key when emptied', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'org', []);
		expect(next).toContain('org:\nprojects:');
	});

	it('replaces a multi-line list without eating the following key', () => {
		const next = setFrontmatterValue(DAILY_NOTE, 'categories', ['[[Daily Notes]]', '[[Journal]]']);
		expect(getBoolean(parseNote(next), 'Wake up Before 8u')).toBe(true);
		expect(getStringList(parseNote(next), 'categories')).toHaveLength(2);
	});

	it('quotes values that would otherwise change meaning', () => {
		const next = setFrontmatterValue(TASK_NOTE, 'priority', 'no');
		expect(next).toContain('priority: "no"');
		expect(getString(parseNote(next), 'priority')).toBe('no');
	});

	it('creates a frontmatter block for a note that has none', () => {
		const next = setFrontmatterValue('# Heading\n\ntext\n', 'status', 'Todo');
		expect(next).toBe('---\nstatus: Todo\n---\n# Heading\n\ntext\n');
	});

	it('refuses to write a note whose YAML is broken', () => {
		// An unterminated flow sequence. Obsidian shows this note fine; we must not rewrite it,
		// because we cannot know what the author meant.
		const broken = '---\ncategories: [[[Tasks]]\nstatus: Todo\n---\nbody\n';
		expect(parseNote(broken).errors.length).toBeGreaterThan(0);
		expect(() => setFrontmatterValue(broken, 'status', 'Done')).toThrow(/did not parse cleanly/);
	});

	it('still reads what it can from a broken note, so it stays visible in the UI', () => {
		const broken = '---\ncategories: [[[Tasks]]\nstatus: Todo\n---\nbody\n';
		expect(getString(parseNote(broken), 'status')).toBe('Todo');
	});

	it('edits a key that sits below a nested map without disturbing it', () => {
		const nested = '---\nmeta:\n  nested:\n    deep: 1\nstatus: Todo\n---\nbody\n';
		const next = setFrontmatterValue(nested, 'status', 'Done');
		expect(next).toBe(nested.replace('status: Todo', 'status: Done'));
	});
});

describe('line endings', () => {
	/**
	 * Several notes in the real vault have LF frontmatter and a CRLF body — some past editor left
	 * them that way. Picking one line ending for the whole file made the key scanner see a single
	 * line and refuse to write these notes at all.
	 */
	const MIXED =
		'---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Ferret Media]]"\nstatus:\n  - In Progress\nsource: https://github.com/FerretMedia/linker\n---\r\n## Tasks\r\n![[Tasks.base#Project Tasks]]\r\n';

	it('reads every key when the frontmatter and body disagree about line endings', () => {
		expect(keys(parseNote(MIXED))).toEqual(['categories', 'org', 'status', 'source']);
	});

	it('edits a note with mixed line endings instead of refusing it', () => {
		const next = setFrontmatterValue(MIXED, 'status', ['Done']);
		expect(getStringList(parseNote(next), 'status')).toEqual(['Done']);
	});

	it('leaves the CRLF body byte-identical', () => {
		const next = setFrontmatterValue(MIXED, 'status', ['Done']);
		expect(parseNote(next).body).toBe(parseNote(MIXED).body);
		expect(next).toContain('---\r\n## Tasks\r\n');
	});

	it('writes a new entry with the terminator its neighbours use', () => {
		const crlf = '---\r\nstatus: Todo\r\npriority: High\r\n---\r\nbody\r\n';
		const next = setFrontmatterValue(crlf, 'due', '2026-08-22');
		expect(next).toBe(
			'---\r\nstatus: Todo\r\npriority: High\r\ndue: 2026-08-22\r\n---\r\nbody\r\n'
		);
	});

	it('replaces a CRLF list without stranding a bare carriage return', () => {
		const crlf = '---\r\norg:\r\n  - "[[A]]"\r\nstatus: Todo\r\n---\r\nbody\r\n';
		const next = setFrontmatterValue(crlf, 'org', ['[[A]]', '[[B]]']);
		expect(next).toBe(
			'---\r\norg:\r\n  - "[[A]]"\r\n  - "[[B]]"\r\nstatus: Todo\r\n---\r\nbody\r\n'
		);
	});

	it('renames a key without disturbing its line terminator', () => {
		const crlf = '---\r\nRun/Workout: false\r\ncreated: 2026-06-09\r\n---\r\nbody\r\n';
		const next = renameFrontmatterKey(crlf, 'Run/Workout', 'Stretch');
		expect(next).toBe('---\r\nStretch: false\r\ncreated: 2026-06-09\r\n---\r\nbody\r\n');
	});
});

describe('setFrontmatterValues', () => {
	it('applies several edits and touches nothing else', () => {
		const next = setFrontmatterValues(TASK_NOTE, { status: 'Done', done: '2026-08-19' });
		expect(getString(parseNote(next), 'status')).toBe('Done');
		expect(getString(parseNote(next), 'done')).toBe('2026-08-19');
		expect(parseNote(next).body).toBe(parseNote(TASK_NOTE).body);
		expect(getString(parseNote(next), 'created')).toBe('2026-08-14');
	});
});

describe('renameFrontmatterKey', () => {
	it('renames a habit key and keeps its value', () => {
		const next = renameFrontmatterKey(DAILY_NOTE, 'Run/Workout', 'Stretch/Run/Workout');
		expect(next).toBe(DAILY_NOTE.replace('Run/Workout: false', 'Stretch/Run/Workout: false'));
		expect(getBoolean(parseNote(next), 'Stretch/Run/Workout')).toBe(false);
	});

	it('is a no-op when the key is absent', () => {
		expect(renameFrontmatterKey(DAILY_NOTE, 'Nope', 'Still Nope')).toBe(DAILY_NOTE);
	});
});

describe('removeFrontmatterKey', () => {
	it('removes a single-line key and nothing around it', () => {
		const next = removeFrontmatterKey(DAILY_NOTE, 'Shower');
		expect(next).toBe(DAILY_NOTE.replace('Shower: false\n', ''));
	});

	it('removes a key together with all of its list items', () => {
		const next = removeFrontmatterKey(TASK_NOTE, 'org');
		expect(next).not.toContain('Schneider Electric');
		expect(getString(parseNote(next), 'priority')).toBe('High');
		expect(getString(parseNote(next), 'created')).toBe('2026-08-14');
	});
});
