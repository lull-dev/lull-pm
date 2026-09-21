import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { CompanyService } from './CompanyService';

/** The real vault's shape: aliased category links, and companies outside Companies/. */
const COMPANY = '---\ncategories:\n  - "[[Categories/Companies|Companies]]"\n---\n';

let adapter: MemoryVaultAdapter;
let service: CompanyService;

beforeEach(async () => {
	adapter = new MemoryVaultAdapter({
		'.obsidian/app.json': '{}',
		'Companies/TrueFerret/TrueFerret.md': COMPANY,
		'Companies/Ferret Media (Zelfstandig)/Ferret Media.md': COMPANY,
		'Companies/Ferret Media (Zelfstandig)/Pricing - Ferret Media.md':
			'---\norg:\n  - "[[Ferret Media]]"\n---\n',
		'Companies/!Fig Sphinx.md': COMPANY,
		// Two real companies that do not live under Companies/ at all.
		'Schneider Electric/Schneider Electric.md': COMPANY,
		'References/Karel de Grote Hogeschool.md': COMPANY
	});
	service = await CompanyService.open(adapter);
});

async function companies() {
	return service.listCompanies(await indexVault(adapter));
}

describe('CompanyService', () => {
	it('finds companies wherever they live, not just under Companies/', async () => {
		expect((await companies()).map((c) => c.name)).toEqual([
			'Ferret Media',
			'Fig Sphinx',
			'Karel de Grote Hogeschool',
			'Schneider Electric',
			'TrueFerret'
		]);
	});

	it('resolves the aliased category link the vault actually writes', async () => {
		expect((await companies()).map((c) => c.name)).toContain('TrueFerret');
	});

	it('strips the sorting bang from the name', async () => {
		const fig = (await companies()).find((c) => c.path === 'Companies/!Fig Sphinx.md');
		expect(fig?.name).toBe('Fig Sphinx');
	});

	it('does not treat a company sub-note as a company', async () => {
		// `Pricing - Ferret Media.md` carries `org:`, not `categories: [[Companies]]`.
		expect((await companies()).map((c) => c.name)).not.toContain('Pricing - Ferret Media');
	});

	it('reports the folder a company owns', async () => {
		const ferret = (await companies()).find((c) => c.name === 'Ferret Media');
		expect(ferret?.folder).toBe('Companies/Ferret Media (Zelfstandig)');
	});

	it('reads a single company off disk', async () => {
		expect((await service.readCompany('Companies/!Fig Sphinx.md')).name).toBe('Fig Sphinx');
	});
});
