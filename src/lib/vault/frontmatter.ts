/**
 * Surgical YAML frontmatter editing.
 *
 * The vault is 1300+ notes of real, irreplaceable data. The rule this module exists to enforce:
 * **an edit to one property must not change a single byte belonging to any other property, or to
 * the note body.** So we never serialise a note from an in-memory model. We read through a real
 * YAML parser (correct semantics), but we write by replacing the exact line range that one key
 * owns, leaving the rest of the file untouched.
 *
 * Line endings are handled per line rather than per file, because real notes mix them: several
 * notes in this vault have LF frontmatter and a CRLF body, left behind by some past editor. Lines
 * are split on \n and keep their own trailing \r, so rejoining restores each line exactly as it
 * was regardless of what its neighbours use.
 *
 * Reading and writing use two independent views of the same text, and `assertConsistent` refuses
 * the write if they disagree about what keys exist. That mismatch means the frontmatter uses YAML
 * we do not understand well enough to edit safely (anchors, multi-line scalars, nested maps), and
 * bailing out is always better than mangling it.
 */

import { isMap, isScalar, isSeq, parseDocument, type Document } from 'yaml';

const FENCE = '---';

export type FrontmatterValue = string | number | boolean | null | string[];

export interface ParsedNote {
	/** The complete, unmodified note text. */
	raw: string;
	/** True when the note opens with a `---` fence. */
	hasFrontmatter: boolean;
	/** Offset of the first character of YAML (just past the opening fence's newline). */
	yamlStart: number;
	/** Offset just past the last character of YAML (the closing fence's first character). */
	yamlEnd: number;
	/** Offset of the first character of the body, past the closing fence and its newline. */
	bodyStart: number;
	/** The YAML source text, fences excluded. */
	yaml: string;
	/** Everything after the closing fence. */
	body: string;
	/** Parsed YAML document, or null when the note has no frontmatter. */
	doc: Document.Parsed | null;
	/**
	 * Problems the YAML parser found. Reads stay best-effort so a damaged note still shows up in
	 * the UI, but any write is refused while this is non-empty.
	 */
	errors: string[];
	/** The newline sequence the note uses. */
	eol: '\n' | '\r\n';
}

/** A top-level key together with the line range it owns, derived by scanning lines. */
interface KeySpan {
	key: string;
	/** Index of the key's own line, relative to the YAML block. */
	startLine: number;
	/** Index just past the last line this key owns (its value lines included). */
	endLine: number;
}

export function parseNote(raw: string): ParsedNote {
	const eol = raw.includes('\r\n') ? '\r\n' : '\n';
	const empty: ParsedNote = {
		raw,
		hasFrontmatter: false,
		yamlStart: 0,
		yamlEnd: 0,
		bodyStart: 0,
		yaml: '',
		body: raw,
		doc: null,
		errors: [],
		eol
	};

	// The opening fence has to be the very first thing in the file.
	if (!raw.startsWith(FENCE)) return empty;
	const afterOpenFence = raw.indexOf('\n');
	if (afterOpenFence === -1) return empty;
	if (raw.slice(FENCE.length, afterOpenFence).trim() !== '') return empty;

	const yamlStart = afterOpenFence + 1;

	// Find the closing fence: a line that is exactly `---`.
	let searchFrom = yamlStart;
	let yamlEnd = -1;
	while (searchFrom <= raw.length) {
		const lineEnd = raw.indexOf('\n', searchFrom);
		const line = raw.slice(searchFrom, lineEnd === -1 ? raw.length : lineEnd);
		if (line.trimEnd() === FENCE) {
			yamlEnd = searchFrom;
			break;
		}
		if (lineEnd === -1) break;
		searchFrom = lineEnd + 1;
	}
	if (yamlEnd === -1) return empty;

	const closingLineEnd = raw.indexOf('\n', yamlEnd);
	const bodyStart = closingLineEnd === -1 ? raw.length : closingLineEnd + 1;
	const yaml = raw.slice(yamlStart, yamlEnd);

	let doc: Document.Parsed | null = null;
	let errors: string[] = [];
	try {
		// `strict: false` keeps us reading notes that Obsidian tolerates but strict YAML rejects.
		doc = parseDocument(yaml, { strict: false });
		// parseDocument collects problems rather than throwing, so they have to be read off the
		// document. A note whose YAML did not parse cleanly must never be written back.
		errors = doc.errors.map((error) => error.message);
	} catch (error) {
		doc = null;
		errors = [error instanceof Error ? error.message : String(error)];
	}

	return {
		raw,
		hasFrontmatter: true,
		yamlStart,
		yamlEnd,
		bodyStart,
		yaml,
		body: raw.slice(bodyStart),
		doc,
		errors,
		eol
	};
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

function pairFor(note: ParsedNote, key: string) {
	const contents = note.doc?.contents;
	if (!contents || !isMap(contents)) return undefined;
	return contents.items.find((pair) => isScalar(pair.key) && String(pair.key.value) === key);
}

/**
 * The scalar's source text, preferred over its parsed value.
 *
 * `created: 2026-08-14` must stay the string "2026-08-14". YAML's core schema already keeps it a
 * string, but reading `source` means we are not at the mercy of a schema change, and it preserves
 * whatever the note actually says.
 */
function scalarText(node: unknown): string | undefined {
	if (!isScalar(node)) return undefined;
	const source = (node as { source?: string }).source;
	if (typeof source === 'string' && source !== '') return unquote(source);
	if (node.value === null || node.value === undefined) return undefined;
	return String(node.value);
}

function unquote(source: string): string {
	const trimmed = source.trim();
	if (trimmed.length >= 2) {
		const first = trimmed[0];
		const last = trimmed[trimmed.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			const inner = trimmed.slice(1, -1);
			return first === '"' ? inner.replace(/\\"/g, '"') : inner.replace(/''/g, "'");
		}
	}
	return trimmed;
}

export function hasKey(note: ParsedNote, key: string): boolean {
	return pairFor(note, key) !== undefined;
}

/** Every top-level key, in the order the note declares them. */
export function keys(note: ParsedNote): string[] {
	const contents = note.doc?.contents;
	if (!contents || !isMap(contents)) return [];
	return contents.items
		.map((pair) => (isScalar(pair.key) ? String(pair.key.value) : null))
		.filter((k): k is string => k !== null);
}

export function getString(note: ParsedNote, key: string): string | undefined {
	const pair = pairFor(note, key);
	if (!pair) return undefined;
	const text = scalarText(pair.value);
	return text === '' ? undefined : text;
}

export function getBoolean(note: ParsedNote, key: string): boolean | undefined {
	const pair = pairFor(note, key);
	if (!pair) return undefined;
	if (isScalar(pair.value) && typeof pair.value.value === 'boolean') return pair.value.value;
	const text = scalarText(pair.value)?.toLowerCase();
	if (text === 'true') return true;
	if (text === 'false') return false;
	return undefined;
}

/**
 * A property read as a list.
 *
 * The vault is inconsistent here by design — `org` is a list, `status` is a scalar on tasks but a
 * list on projects. A lone scalar reads as a one-element list so callers do not have to care.
 */
export function getStringList(note: ParsedNote, key: string): string[] {
	const pair = pairFor(note, key);
	if (!pair || pair.value === null) return [];
	if (isSeq(pair.value)) {
		return pair.value.items
			.map((item) => scalarText(item))
			.filter((v): v is string => v !== undefined && v !== '');
	}
	const single = scalarText(pair.value);
	return single === undefined || single === '' ? [] : [single];
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/** A line that starts a top-level key: no leading whitespace, not a comment, `key:` form. */
const TOP_LEVEL_KEY = /^([^\s#][^:]*):(?:\s|$)/;

function scanKeySpans(yaml: string): KeySpan[] {
	const lines = splitLines(yaml);
	const spans: KeySpan[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = TOP_LEVEL_KEY.exec(lines[i]);
		if (!match) continue;
		if (spans.length > 0) spans[spans.length - 1].endLine = i;
		spans.push({ key: match[1].trim(), startLine: i, endLine: lines.length });
	}
	if (spans.length > 0) {
		// The final key owns everything up to the last non-empty line; trailing blank lines inside
		// the block stay where they are rather than being swallowed into that key's span.
		let last = lines.length;
		while (last > spans[spans.length - 1].startLine + 1 && lines[last - 1].trim() === '') last--;
		spans[spans.length - 1].endLine = last;
	}
	return spans;
}

/**
 * Both views of the frontmatter must agree on the key set before we are willing to write.
 *
 * If the line scanner and the YAML parser disagree, the note uses structure the scanner cannot
 * model, and a line-range replacement could destroy neighbouring data.
 */
function assertConsistent(note: ParsedNote, spans: KeySpan[]): void {
	if (note.errors.length > 0) {
		throw new Error(
			`Refusing to edit frontmatter: its YAML did not parse cleanly (${note.errors[0]}). ` +
				'Fix this note in Obsidian first.'
		);
	}

	const fromParser = keys(note);
	const fromScan = spans.map((s) => s.key);
	const same =
		fromParser.length === fromScan.length && fromParser.every((k, i) => k === fromScan[i]);
	if (!same) {
		throw new Error(
			'Refusing to edit frontmatter: its structure could not be read unambiguously ' +
				`(parser saw [${fromParser.join(', ')}], scanner saw [${fromScan.join(', ')}]). ` +
				'Edit this note in Obsidian instead.'
		);
	}
}

/**
 * Split on \n, leaving any trailing \r attached to its own line.
 *
 * Rejoining with \n therefore reproduces the original bytes even when a note mixes LF and CRLF,
 * which several notes in this vault do.
 */
function splitLines(text: string): string[] {
	return text.split('\n');
}

/** The line terminator a given line uses: '\r' for CRLF, '' for LF. */
function suffixOf(line: string | undefined): string {
	return line?.endsWith('\r') ? '\r' : '';
}

/** True when a plain (unquoted) scalar would survive a YAML round-trip unchanged. */
function needsQuoting(value: string): boolean {
	if (value === '') return true;
	if (value !== value.trim()) return true;
	if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return true;
	if (/:\s/.test(value) || value.endsWith(':')) return true;
	if (/\s#/.test(value)) return true;
	// Reserved plain scalars that would otherwise change type on re-read.
	if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
	return false;
}

export function quoteIfNeeded(value: string): string {
	return needsQuoting(value) ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
}

/**
 * Serialise one key/value pair as lines, in the vault's own style: 2-space indented block
 * sequences, quoted wikilinks.
 *
 * `suffix` carries the line terminator of whatever the entry is replacing, so a CRLF block stays
 * CRLF and an LF block stays LF.
 */
function serialiseEntry(key: string, value: FrontmatterValue, suffix: string): string[] {
	const lines = Array.isArray(value)
		? value.length === 0
			? [`${key}:`]
			: [`${key}:`, ...value.map((item) => `  - ${quoteIfNeeded(item)}`)]
		: value === null || value === undefined
			? [`${key}:`]
			: typeof value === 'boolean'
				? [`${key}: ${value ? 'true' : 'false'}`]
				: typeof value === 'number'
					? [`${key}: ${value}`]
					: [`${key}: ${quoteIfNeeded(value)}`];

	return lines.map((line) => line + suffix);
}

/**
 * Set one frontmatter property and return the new note text.
 *
 * Only the lines belonging to `key` are replaced. Every other key, every comment, the fences and
 * the entire body come through byte-for-byte. A key that does not exist yet is appended to the end
 * of the block, which keeps the note's existing property order intact.
 */
export function setFrontmatterValue(raw: string, key: string, value: FrontmatterValue): string {
	const note = parseNote(raw);
	if (!note.hasFrontmatter) {
		const eol = note.eol;
		const entry = serialiseEntry(key, value, '').join(eol);
		return `${FENCE}${eol}${entry}${eol}${FENCE}${eol}${raw}`;
	}

	// Setting a property to what it already holds must never touch the file, even when the note
	// writes that value differently than we would. Real notes are full of harmless variation —
	// `title: "How is this Website so fast!?"` is quoted though it need not be, and one clipping has
	// a stray empty list item — and re-serialising would silently "tidy" all of it into a diff the
	// user never asked for. Checking equivalence first is also what keeps an unchanged toggle from
	// bumping the mtime and waking Obsidian.
	if (holdsValue(note, key, value)) return raw;

	const spans = scanKeySpans(note.yaml);
	assertConsistent(note, spans);

	const lines = splitLines(note.yaml);
	const span = spans.find((s) => s.key === key);

	// Match the line terminator of whatever we are replacing, so a note that mixes LF and CRLF
	// keeps each region exactly as it was.
	const suffix = suffixOf(span ? lines[span.startLine] : lastContentLine(lines));
	const entry = serialiseEntry(key, value, suffix);

	const nextLines = span
		? [...lines.slice(0, span.startLine), ...entry, ...lines.slice(span.endLine)]
		: insertAtEnd(lines, entry);

	const nextYaml = nextLines.join('\n');
	return note.raw.slice(0, note.yamlStart) + nextYaml + note.raw.slice(note.yamlEnd);
}

/**
 * True when the note's property already means what `value` means.
 *
 * Compares meaning, not text, so quoting style and formatting differences do not count as changes.
 * A scalar matches a one-element list on purpose: task `status` is a scalar and project `status` is
 * a list, deliberately, and lull must not quietly convert one into the other.
 */
function holdsValue(note: ParsedNote, key: string, value: FrontmatterValue): boolean {
	if (!hasKey(note, key)) return false;

	if (typeof value === 'boolean') return getBoolean(note, key) === value;

	if (Array.isArray(value)) {
		const current = getStringList(note, key);
		return current.length === value.length && current.every((item, i) => item === value[i]);
	}

	if (value === null) {
		return getString(note, key) === undefined && getStringList(note, key).length === 0;
	}

	return getString(note, key) === String(value);
}

/** The last line in the block that carries content, used as the style model for a new entry. */
function lastContentLine(lines: string[]): string | undefined {
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trim() !== '') return lines[i];
	}
	return undefined;
}

/** Append a new entry after the last content line, before any trailing blank lines. */
function insertAtEnd(lines: string[], entry: string[]): string[] {
	let at = lines.length;
	while (at > 0 && lines[at - 1].trim() === '') at--;
	return [...lines.slice(0, at), ...entry, ...lines.slice(at)];
}

/** Apply several property edits in one pass. Order is preserved; each edit re-reads the text. */
export function setFrontmatterValues(raw: string, edits: Record<string, FrontmatterValue>): string {
	return Object.entries(edits).reduce(
		(text, [key, value]) => setFrontmatterValue(text, key, value),
		raw
	);
}

/** Remove a property entirely. Returns the text unchanged when the key is absent. */
export function removeFrontmatterKey(raw: string, key: string): string {
	const note = parseNote(raw);
	if (!note.hasFrontmatter) return raw;

	const spans = scanKeySpans(note.yaml);
	assertConsistent(note, spans);

	const span = spans.find((s) => s.key === key);
	if (!span) return raw;

	const lines = splitLines(note.yaml);
	const nextYaml = [...lines.slice(0, span.startLine), ...lines.slice(span.endLine)].join('\n');
	return note.raw.slice(0, note.yamlStart) + nextYaml + note.raw.slice(note.yamlEnd);
}

/**
 * Rename a property, keeping its value and its position in the block.
 *
 * Used when a habit is renamed: the key has to change across the template and every daily note.
 */
export function renameFrontmatterKey(raw: string, from: string, to: string): string {
	const note = parseNote(raw);
	if (!note.hasFrontmatter) return raw;

	const spans = scanKeySpans(note.yaml);
	assertConsistent(note, spans);

	const span = spans.find((s) => s.key === from);
	if (!span) return raw;

	const lines = splitLines(note.yaml);
	// Only the key text on the key's own line changes; its value lines, and the line's own
	// terminator, are left exactly as they were.
	const keyLine = lines[span.startLine];
	const colon = keyLine.indexOf(':');
	lines[span.startLine] = to + keyLine.slice(colon);

	return note.raw.slice(0, note.yamlStart) + lines.join('\n') + note.raw.slice(note.yamlEnd);
}
