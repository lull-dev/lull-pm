export const DAY_RESET_HOUR = 3;

export function normalizeToMidnight(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function getLogicalToday(resetHour: number = DAY_RESET_HOUR): Date {
	const now = new Date();
	if (now.getHours() < resetHour) {
		now.setDate(now.getDate() - 1);
	}
	return normalizeToMidnight(now);
}

export function formatLocalDateYMD(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function sameDay(a: Date, b: Date): boolean {
	return formatLocalDateYMD(a) === formatLocalDateYMD(b);
}
