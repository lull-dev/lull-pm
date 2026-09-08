import { describe, expect, it } from 'vitest';
import {
	asWikilink,
	displayName,
	formatWikilink,
	parseWikilink,
	parseWikilinks,
	sameTarget
} from './wikilink';

describe('parseWikilink', () => {
	it('parses a plain link', () => {
		expect(parseWikilink('[[Schneider Electric]]')).toMatchObject({
			target: 'Schneider Electric',
			name: 'Schneider Electric',
			alias: undefined
		});
	});

	it('parses a path with an alias, as Companies/lull.md writes it', () => {
		expect(parseWikilink('[[Categories/Companies|Companies]]')).toMatchObject({
			target: 'Categories/Companies',
			name: 'Companies',
			alias: 'Companies'
		});
	});

	it('keeps the leading ! that marks an index note', () => {
		expect(parseWikilink('[[!Dynamic Shelving Utility]]')?.name).toBe('!Dynamic Shelving Utility');
	});

	it('splits off a heading reference', () => {
		expect(parseWikilink('[[Tasks.base#Project Tasks]]')).toMatchObject({
			name: 'Tasks.base',
			heading: 'Project Tasks'
		});
	});

	it('tolerates surrounding whitespace', () => {
		expect(parseWikilink('  [[Ferret Media]]  ')?.name).toBe('Ferret Media');
	});

	it('returns undefined for text that is not a link', () => {
		expect(parseWikilink('Schneider Electric')).toBeUndefined();
		expect(parseWikilink('see [[A]] and [[B]]')).toBeUndefined();
	});
});

describe('parseWikilinks', () => {
	it('finds every link in a block of text', () => {
		const body = '[[!lull-Extension]]\n[[!lull.app]]\n\nsee also [[lull]]';
		expect(parseWikilinks(body).map((l) => l.name)).toEqual([
			'!lull-Extension',
			'!lull.app',
			'lull'
		]);
	});
});

describe('sameTarget', () => {
	it('matches by basename across path and alias forms', () => {
		expect(sameTarget('[[Companies]]', '[[Categories/Companies|Companies]]')).toBe(true);
	});

	it('matches a bare name against a link', () => {
		expect(sameTarget('Schneider Electric', '[[Schneider Electric]]')).toBe(true);
	});

	it('ignores case, the way Obsidian resolves links', () => {
		expect(sameTarget('[[ferret media]]', '[[Ferret Media]]')).toBe(true);
	});

	it('does not match different notes', () => {
		expect(sameTarget('[[TrueFerret]]', '[[Taboen Gang]]')).toBe(false);
	});
});

describe('formatWikilink and displayName', () => {
	it('round-trips a plain link', () => {
		const text = formatWikilink('Ferret Media');
		expect(text).toBe('[[Ferret Media]]');
		expect(parseWikilink(text)?.name).toBe('Ferret Media');
	});

	it('shows the alias when there is one, otherwise the name', () => {
		expect(displayName(asWikilink('[[Categories/Companies|Companies]]'))).toBe('Companies');
		expect(displayName(asWikilink('[[Schneider Electric]]'))).toBe('Schneider Electric');
	});
});

describe('asWikilink', () => {
	it('accepts a bare name from a hand-edited note', () => {
		expect(asWikilink('Schneider Electric').name).toBe('Schneider Electric');
	});
});
