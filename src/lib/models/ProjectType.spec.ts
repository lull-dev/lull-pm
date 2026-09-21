import { describe, expect, it } from 'vitest';
import {
	defaultType,
	isDone,
	phaseOf,
	statusesFor,
	typeFor,
	type ProjectType
} from './ProjectType';

const content: ProjectType = {
	name: 'Content',
	template: 'Templates/Content Project Template.md',
	statuses: ['Idea', 'Scripting', 'Filming', 'Editing', 'Review', 'Published'],
	terminal: ['Published'],
	folders: []
};

describe('typeFor', () => {
	it('finds a named type', () => {
		expect(typeFor('Content', [content]).statuses).toContain('Filming');
	});

	it('matches case-insensitively', () => {
		expect(typeFor('content', [content]).name).toBe('Content');
	});

	it('falls back to the default for a type nothing defines', () => {
		expect(typeFor('Nonexistent', [content]).statuses).toEqual(defaultType().statuses);
	});

	it('falls back to the default when a project declares no type', () => {
		expect(typeFor('', [content]).statuses).toEqual(defaultType().statuses);
	});
});

describe('statusesFor', () => {
	it('offers the type pipeline', () => {
		expect(statusesFor('Filming', content)).toEqual(content.statuses);
	});

	it('keeps a status the note holds but the pipeline does not list', () => {
		// The note is the authority on what it says. Dropping its current status from the picker
		// would make the UI quietly lie about where the project is.
		expect(statusesFor('Abandoned', content)).toEqual([...content.statuses, 'Abandoned']);
	});

	it('does not duplicate a status that differs only in case', () => {
		expect(statusesFor('filming', content)).toEqual(content.statuses);
	});
});

describe('phaseOf', () => {
	it('calls the first status idea', () => {
		expect(phaseOf('Idea', content)).toBe('idea');
	});

	it('calls everything in between active', () => {
		expect(phaseOf('Filming', content)).toBe('active');
		expect(phaseOf('Review', content)).toBe('active');
	});

	it('calls a terminal status done, whatever it is named', () => {
		expect(phaseOf('Published', content)).toBe('done');
		expect(isDone('Published', content)).toBe(true);
		expect(isDone('Filming', content)).toBe(false);
	});

	it('treats an unset status as idea', () => {
		expect(phaseOf('', content)).toBe('idea');
	});

	it('treats a status the pipeline does not know as active', () => {
		expect(phaseOf('Abandoned', content)).toBe('active');
	});

	it('works for the default type too', () => {
		expect(isDone('Done', defaultType())).toBe(true);
		expect(phaseOf('In Progress', defaultType())).toBe('active');
	});
});
