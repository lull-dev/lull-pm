import { describe, expect, it } from 'vitest';
import { appendSection, findSection, findSections, replaceSectionContent } from './section';

const TASK = `---
status: Todo
---

## Why
Needed for the CP migration work.

## Steps
-  [ ] Draft the migration plan
	-  [ ] Decide whether these can be universal scripts

## Notes
Source: [[TODOs Werk]]
`;

const DAILY = `---
Make Bed: false
---

## Quick ToDo:
-  [ ] call the dentist
`;

describe('findSections', () => {
	it('finds every heading with its level', () => {
		expect(findSections(TASK).map((s) => [s.title, s.level])).toEqual([
			['Why', 2],
			['Steps', 2],
			['Notes', 2]
		]);
	});

	it('ends a section at the next heading of equal or shallower depth', () => {
		const steps = findSection(TASK, 'Steps')!;
		const content = TASK.slice(steps.contentStart, steps.contentEnd);
		expect(content).toContain('Draft the migration plan');
		expect(content).not.toContain('Source:');
	});

	it('gives the last section the rest of the note', () => {
		const notes = findSection(TASK, 'Notes')!;
		expect(notes.contentEnd).toBe(TASK.length);
	});

	it('nests a deeper heading inside its parent', () => {
		const raw = '# Top\nintro\n## Child\nchild body\n# Next\n';
		const top = findSection(raw, 'Top')!;
		expect(raw.slice(top.contentStart, top.contentEnd)).toBe('intro\n## Child\nchild body\n');
	});
});

describe('findSection', () => {
	it('matches the template heading despite its trailing colon', () => {
		// The daily note template writes `## Quick ToDo:`.
		expect(findSection(DAILY, 'Quick ToDo')).toBeDefined();
	});

	it('ignores case', () => {
		expect(findSection(TASK, 'why')).toBeDefined();
	});

	it('returns undefined for a heading the note does not have', () => {
		expect(findSection(TASK, 'Retrospective')).toBeUndefined();
	});
});

describe('replaceSectionContent', () => {
	it('replaces one section and leaves the others byte-identical', () => {
		const steps = findSection(TASK, 'Steps')!;
		const next = replaceSectionContent(TASK, steps, '-  [x] Draft the migration plan\n\n');
		expect(next).toContain('## Why\nNeeded for the CP migration work.');
		expect(next).toContain('## Notes\nSource: [[TODOs Werk]]');
		expect(next).not.toContain('universal scripts');
	});

	it('leaves the frontmatter alone', () => {
		const notes = findSection(TASK, 'Notes')!;
		const next = replaceSectionContent(TASK, notes, 'nothing\n');
		expect(next.startsWith('---\nstatus: Todo\n---\n')).toBe(true);
	});
});

describe('appendSection', () => {
	it('adds a heading at the end with a blank line before it', () => {
		expect(appendSection('body text\n', 'Notes')).toBe('body text\n\n## Notes\n');
	});

	it('does not stack blank lines', () => {
		expect(appendSection('body text\n\n', 'Notes')).toBe('body text\n\n## Notes\n');
	});
});
