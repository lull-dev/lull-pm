/**
 * Just enough Templater to materialise a note from a template.
 *
 * Templater only runs inside Obsidian, so when lull creates a daily note or a task note from a
 * template it has to expand the tags itself. The vault's templates use exactly one construct —
 * `<% tp.date.now("YYYY-MM-DD") %>` — plus the occasional `tp.file.title`, and this covers those.
 *
 * A tag we do not understand is left exactly as it is rather than guessed at or stripped. That is
 * the conservative choice: the tag stays visible in Obsidian, and Templater can still expand it.
 */

export interface TemplateContext {
	/** The date the note is for. Drives `tp.date.now`. */
	date: Date;
	/** The note's title, without folders or extension. Drives `tp.file.title`. */
	title?: string;
}

/** `<% ... %>`, including Templater's `<%*` and `<%-` variants. */
const TAG = /<%[-*_]?\s*([\s\S]*?)\s*[-_]?%>/g;

export function applyTemplate(template: string, context: TemplateContext): string {
	return template.replace(TAG, (whole, expression: string) => {
		const value = evaluate(expression.trim(), context);
		return value ?? whole;
	});
}

function evaluate(expression: string, context: TemplateContext): string | undefined {
	const dateNow = /^tp\.date\.now\(\s*(.*?)\s*\)$/.exec(expression);
	if (dateNow) return formatDate(context.date, parseDateArgs(dateNow[1]));

	if (expression === 'tp.file.title') return context.title;

	return undefined;
}

interface DateArgs {
	format: string;
	/** Day offset, as Templater's second argument. */
	offset: number;
}

function parseDateArgs(args: string): DateArgs {
	if (args === '') return { format: 'YYYY-MM-DD', offset: 0 };

	// Arguments are simple literals in this vault: a quoted format, optionally a numeric offset.
	const parts = splitArgs(args);
	const format = stripQuotes(parts[0] ?? '"YYYY-MM-DD"');
	const offset = parts[1] !== undefined ? Number(stripQuotes(parts[1])) : 0;
	return { format, offset: Number.isFinite(offset) ? offset : 0 };
}

function splitArgs(args: string): string[] {
	const out: string[] = [];
	let current = '';
	let quote: string | null = null;

	for (const char of args) {
		if (quote) {
			if (char === quote) quote = null;
			current += char;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === ',') {
			out.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	if (current.trim() !== '') out.push(current.trim());
	return out;
}

function stripQuotes(value: string): string {
	const trimmed = value.trim();
	const first = trimmed[0];
	if ((first === '"' || first === "'") && trimmed[trimmed.length - 1] === first) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** Moment-style tokens, longest first so `YYYY` is matched before `YY`. */
const TOKEN = /YYYY|YY|MMMM|MMM|MM|M|DDDD|dddd|ddd|DD|D|HH|H|mm|m|ss|s/g;

export function formatDate(date: Date, { format, offset }: DateArgs): string {
	const value = new Date(date);
	if (offset !== 0) value.setDate(value.getDate() + offset);

	const pad = (n: number) => String(n).padStart(2, '0');

	return format.replace(TOKEN, (token) => {
		switch (token) {
			case 'YYYY':
				return String(value.getFullYear());
			case 'YY':
				return pad(value.getFullYear() % 100);
			case 'MMMM':
				return MONTHS[value.getMonth()];
			case 'MMM':
				return MONTHS[value.getMonth()].slice(0, 3);
			case 'MM':
				return pad(value.getMonth() + 1);
			case 'M':
				return String(value.getMonth() + 1);
			case 'DDDD':
			case 'dddd':
				return DAYS[value.getDay()];
			case 'ddd':
				return DAYS[value.getDay()].slice(0, 3);
			case 'DD':
				return pad(value.getDate());
			case 'D':
				return String(value.getDate());
			case 'HH':
				return pad(value.getHours());
			case 'H':
				return String(value.getHours());
			case 'mm':
				return pad(value.getMinutes());
			case 'm':
				return String(value.getMinutes());
			case 'ss':
				return pad(value.getSeconds());
			case 's':
				return String(value.getSeconds());
			default:
				return token;
		}
	});
}

/** True when the text still contains a Templater tag lull did not expand. */
export function hasUnexpandedTags(text: string): boolean {
	TAG.lastIndex = 0;
	return TAG.test(text);
}
