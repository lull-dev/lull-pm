import { describe, expect, it } from 'vitest';
import {
	appendCheckbox,
	findCheckboxes,
	isResolved,
	setCheckboxState,
	setCheckboxText
} from './checkbox';
import { findSection } from './section';

/**
 * The vault writes `-  [ ]` with two spaces in templates and task notes, but the legacy dumps in
 * All TODOs.md use single-space `- [ ]`, and nesting is done with tabs. Toggling must never
 * normalise any of that — a normalising write would produce a ~590 line diff across the vault.
 */

const MIXED = `## Student Events
-  [ ] Edit Content Voor start Academie jaar
-  [x] Finish User Stories and add them to GitHub
-  [-] Complete 40 Questions Decade
-  [/] Complete 40 Questions Yearly

- [ ] belgian politics
- [ ] you don't know fck shit

-  [ ] create ideas files obsidian
	-  [ ] belgian politics
	-  [ ] you don't know shit
`;

const DAILY = `---
categories:
  - "[[Daily Notes]]"
Make Bed: false
---

## Quick ToDo:
-  [ ] call the dentist
-  [x] pay invoice




`;

describe('findCheckboxes', () => {
	it('finds every state the vault uses', () => {
		const boxes = findCheckboxes(MIXED);
		expect(boxes.map((b) => b.state)).toEqual([' ', 'x', '-', '/', ' ', ' ', ' ', ' ', ' ']);
	});

	it('reads nesting depth from tabs', () => {
		const boxes = findCheckboxes(MIXED);
		const nested = boxes.filter((b) => b.indent.includes('\t'));
		expect(nested).toHaveLength(2);
		expect(nested.every((b) => b.depth === 1)).toBe(true);
	});

	it('strips the checkbox syntax from the text', () => {
		expect(findCheckboxes(MIXED)[0].text).toBe('Edit Content Voor start Academie jaar');
	});

	it('points stateOffset at the character between the brackets', () => {
		for (const box of findCheckboxes(MIXED)) {
			expect(MIXED[box.stateOffset - 1]).toBe('[');
			expect(MIXED[box.stateOffset + 1]).toBe(']');
		}
	});

	it('can be scoped to a section', () => {
		const section = findSection(DAILY, 'Quick ToDo');
		expect(section).toBeDefined();
		const boxes = findCheckboxes(DAILY, {
			start: section!.contentStart,
			end: section!.contentEnd
		});
		expect(boxes.map((b) => b.text)).toEqual(['call the dentist', 'pay invoice']);
	});

	it('treats resolved as done or cancelled, but not partial', () => {
		const [, done, cancelled, partial] = findCheckboxes(MIXED);
		expect(isResolved(done)).toBe(true);
		expect(isResolved(cancelled)).toBe(true);
		expect(isResolved(partial)).toBe(false);
	});
});

describe('setCheckboxState', () => {
	it('changes exactly one character', () => {
		const box = findCheckboxes(MIXED)[0];
		const next = setCheckboxState(MIXED, box, 'x');
		expect(next).toHaveLength(MIXED.length);
		const diffs = [...next].filter((ch, i) => ch !== MIXED[i]);
		expect(diffs).toEqual(['x']);
	});

	it('preserves the two-space vault style', () => {
		const box = findCheckboxes(MIXED)[0];
		expect(setCheckboxState(MIXED, box, 'x')).toContain(
			'-  [x] Edit Content Voor start Academie jaar'
		);
	});

	it('preserves single-space style where the note uses it', () => {
		const box = findCheckboxes(MIXED).find((b) => b.text === 'belgian politics' && b.depth === 0)!;
		expect(setCheckboxState(MIXED, box, 'x')).toContain('- [x] belgian politics');
	});

	it('preserves tab indentation on nested items', () => {
		const box = findCheckboxes(MIXED).find((b) => b.depth === 1)!;
		expect(setCheckboxState(MIXED, box, 'x')).toContain('\t-  [x] belgian politics');
	});

	it('is a no-op when the state already matches', () => {
		const box = findCheckboxes(MIXED)[1];
		expect(setCheckboxState(MIXED, box, 'x')).toBe(MIXED);
	});

	it('refuses to write when the note moved under it', () => {
		const box = findCheckboxes(MIXED)[0];
		// Someone ticked it in Obsidian between our read and our write.
		const changed = setCheckboxState(MIXED, box, 'x');
		expect(() => setCheckboxState(changed, box, '-')).toThrow(/moved since it was read/);
	});
});

describe('setCheckboxText', () => {
	it('rewrites the text and keeps marker, gap and state', () => {
		const box = findCheckboxes(MIXED)[1];
		expect(setCheckboxText(MIXED, box, 'Finish user stories')).toContain(
			'-  [x] Finish user stories'
		);
	});
});

describe('appendCheckbox', () => {
	it('adds an item in the style of its neighbours', () => {
		const section = findSection(DAILY, 'Quick ToDo')!;
		const next = appendCheckbox(
			DAILY,
			{ start: section.contentStart, end: section.contentEnd },
			'book a haircut'
		);
		expect(next).toContain('-  [x] pay invoice\n-  [ ] book a haircut');
	});

	it('does not disturb the frontmatter', () => {
		const section = findSection(DAILY, 'Quick ToDo')!;
		const next = appendCheckbox(
			DAILY,
			{ start: section.contentStart, end: section.contentEnd },
			'book a haircut'
		);
		expect(next.slice(0, next.indexOf('## Quick ToDo'))).toBe(
			DAILY.slice(0, DAILY.indexOf('## Quick ToDo'))
		);
	});

	it('falls back to the vault default style in an empty section', () => {
		const empty = '## Quick ToDo:\n\n\n';
		const next = appendCheckbox(empty, { start: 15, end: empty.length }, 'first item');
		expect(next).toContain('-  [ ] first item');
	});
});
