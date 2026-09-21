/**
 * Companies, read as notes claiming `categories: [[Companies]]`.
 *
 * Read-only for now, deliberately. A company in this vault is a hand-written note with a brand
 * guide, pricing, clients and years of context in it — `Companies/TrueFerret/TrueFerret.md` is
 * 340-odd sub-notes deep. lull-pm has nothing to add to that, and creating one from a stub would
 * only produce a worse version of a note the user would write themselves. It lists them, links
 * them to projects and goals, and opens them in Obsidian.
 */

import { noteName, type VaultAdapter } from '$lib/vault/adapter';
import { getString, parseNote } from '$lib/vault/frontmatter';
import type { VaultIndex } from '$lib/vault/notes';
import type { Company } from '$lib/models/Company';

/** The category a company note claims. */
export const COMPANY_CATEGORY = 'Companies';

export class CompanyService {
	private constructor(private readonly adapter: VaultAdapter) {}

	static async open(adapter: VaultAdapter): Promise<CompanyService> {
		return new CompanyService(adapter);
	}

	/** Every company in the vault, alphabetical, wherever it lives. */
	listCompanies(index: VaultIndex): Company[] {
		return index
			.byCategory(COMPANY_CATEGORY)
			.map((note) => ({
				path: note.path,
				name: note.title,
				folder: note.folder,
				created: getString(note.note, 'created') ?? null
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readCompany(path: string): Promise<Company> {
		const note = parseNote(await this.adapter.read(path));
		const slash = path.lastIndexOf('/');
		return {
			path,
			name: noteName(path).replace(/^!/, ''),
			folder: slash === -1 ? '' : path.slice(0, slash),
			created: getString(note, 'created') ?? null
		};
	}
}
