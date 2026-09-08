/**
 * Markdown checkbox reading and toggling.
 *
 * The vault's own style is `-  [ ]` — dash, **two** spaces — with tab indentation for nesting, but
 * the legacy dumps in `All TODOs.md` also contain single-space `- [ ]`. Neither style is wrong, so
 * this module never normalises: a toggle rewrites exactly the one character between the brackets
 * and leaves the marker, the gap and the indentation as it found them.
 *
 * Checkbox states in use across the vault: ' ' todo, 'x' done, '-' cancelled, '/' partial.
 */

export type CheckboxState = ' ' | 'x' | '-' | '/';

export interface Checkbox {
	/** Zero-based line number within the note. */
	line: number;
	/** Character offset of the state character itself, within the note. */
	stateOffset: number;
	state: CheckboxState;
	/** Text after the checkbox, trimmed. */
	text: string;
	/** Raw leading whitespace, used to infer nesting depth. */
	indent: string;
	/** Nesting depth: one level per tab, or per two leading spaces. */
	depth: number;
}

/** `- [ ] text`, tolerating any indent, any of -/*&#43;, and any gap width. */
const CHECKBOX = /^([ \t]*)([-*+])([ \t]+)\[([ xX\-/])\][ \t]*(.*)$/;

function depthOf(indent: string): number {
	const tabs = (indent.match(/\t/g) ?? []).length;
	const spaces = (indent.match(/ /g) ?? []).length;
	return tabs + Math.floor(spaces / 2);
}

function normaliseState(raw: string): CheckboxState {
	const lower = raw.toLowerCase();
	return lower === 'x' || lower === '-' || lower === '/' ? (lower as CheckboxState) : ' ';
}

/**
 * Every checkbox in the text.
 *
 * `range` optionally limits the scan to a character range, which is how section-scoped reads
 * (a task's `## Steps`, a daily note's `## Quick ToDo`) are done.
 */
export function findCheckboxes(raw: string, range?: { start: number; end: number }): Checkbox[] {
	const start = range?.start ?? 0;
	const end = range?.end ?? raw.length;

	const found: Checkbox[] = [];
	let offset = 0;
	let line = 0;

	for (const text of raw.split('\n')) {
		const lineStart = offset;
		offset += text.length + 1;
		line++;

		if (lineStart < start || lineStart >= end) continue;

		const match = CHECKBOX.exec(text);
		if (!match) continue;

		const [, indent, marker, gap, state, body] = match;
		found.push({
			line: line - 1,
			// indent + marker + gap + '[' lands exactly on the state character.
			stateOffset: lineStart + indent.length + marker.length + gap.length + 1,
			state: normaliseState(state),
			text: body.trim(),
			indent,
			depth: depthOf(indent)
		});
	}

	return found;
}

/**
 * Flip one checkbox, replacing a single character in the note.
 *
 * Takes the `Checkbox` returned by `findCheckboxes` on the *same* text, so the caller is forced to
 * have read the current file before writing to it.
 */
export function setCheckboxState(raw: string, checkbox: Checkbox, state: CheckboxState): string {
	const current = raw[checkbox.stateOffset];
	if (normaliseState(current) !== checkbox.state) {
		throw new Error(
			`Checkbox at line ${checkbox.line + 1} moved since it was read ` +
				`(expected '${checkbox.state}', found '${current}'). Re-read the note and retry.`
		);
	}
	if (checkbox.state === state) return raw;
	return raw.slice(0, checkbox.stateOffset) + state + raw.slice(checkbox.stateOffset + 1);
}

export function isDone(checkbox: Checkbox): boolean {
	return checkbox.state === 'x';
}

/** True once a checkbox is resolved one way or another — done or explicitly cancelled. */
export function isResolved(checkbox: Checkbox): boolean {
	return checkbox.state === 'x' || checkbox.state === '-';
}

/**
 * Rewrite a checkbox's text, keeping its marker, gap, indent and state.
 *
 * Only the text after `] ` is replaced, so trailing tags or links the caller passes through are
 * their own responsibility.
 */
export function setCheckboxText(raw: string, checkbox: Checkbox, text: string): string {
	const lines = raw.split('\n');
	const match = CHECKBOX.exec(lines[checkbox.line]);
	if (!match) {
		throw new Error(`Line ${checkbox.line + 1} is no longer a checkbox. Re-read the note.`);
	}
	const [, indent, marker, gap, state] = match;
	lines[checkbox.line] = `${indent}${marker}${gap}[${state}] ${text}`;
	return lines.join('\n');
}

/**
 * Insert a new checkbox as the last item of a range, matching the style already used there.
 *
 * Style is copied from the last checkbox in range so a new item in `## Quick ToDo` comes out as
 * `-  [ ]` like its neighbours rather than in some house style of ours.
 */
export function appendCheckbox(
	raw: string,
	range: { start: number; end: number },
	text: string,
	state: CheckboxState = ' '
): string {
	const existing = findCheckboxes(raw, range);
	const template = existing[existing.length - 1];
	const indent = template?.indent ?? '';
	const line = template
		? `${indent}${templateMarker(raw, template)}[${state}] ${text}`
		: `-  [${state}] ${text}`;

	// Insert after the last checkbox when there is one, otherwise at the end of the range. Either
	// way we skip back over blank lines so the item joins the list instead of floating below it.
	const anchor = template ? endOfLine(raw, template.stateOffset) : trimEnd(raw, range);
	return raw.slice(0, anchor) + '\n' + line + raw.slice(anchor);
}

function templateMarker(raw: string, checkbox: Checkbox): string {
	const line = raw.split('\n')[checkbox.line];
	const match = CHECKBOX.exec(line);
	return match ? `${match[2]}${match[3]}` : '-  ';
}

function endOfLine(raw: string, offset: number): number {
	const next = raw.indexOf('\n', offset);
	return next === -1 ? raw.length : next;
}

function trimEnd(raw: string, range: { start: number; end: number }): number {
	let at = Math.min(range.end, raw.length);
	while (at > range.start && /\s/.test(raw[at - 1])) at--;
	return at;
}
