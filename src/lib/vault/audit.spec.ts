import { describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from './adapter.memory';
import { auditVault, countByKind, type Finding } from './audit';
import { indexVault } from './notes';

const FOLDERS = ['Tasks', 'Projects', 'Companies', 'Goals', 'Categories/Buckets'];

async function audit(files: Record<string, string>): Promise<Finding[]> {
	return auditVault(await indexVault(new MemoryVaultAdapter(files)), { typedFolders: FOLDERS });
}

const GOOD_PROJECT = '---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Ferret Media]]"\n---\n';

describe('auditVault', () => {
	it('finds nothing wrong with a vault that follows the structure', async () => {
		expect(
			await audit({
				'Projects/Marketing Website.md': GOOD_PROJECT,
				'Tasks/Design the button.md':
					'---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\nprojects:\n  - "[[Marketing Website]]"\n---\n'
			})
		).toEqual([]);
	});

	it('reports a note whose frontmatter does not parse, and says lull-pm will not write it', async () => {
		const findings = await audit({
			'Projects/Broken.md': '---\ncategories: [[[Projects]]\nstatus: Idea\n---\nbody\n'
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].kind).toBe('unparseable-frontmatter');
		expect(findings[0].severity).toBe('blocking');
		expect(findings[0].suggestion).toMatch(/refuse to change it/);
	});

	it('reports a project connected to both a company and a bucket, naming both', async () => {
		const findings = await audit({
			'Projects/Confused.md':
				'---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Ferret Media]]"\n' +
				'bucket:\n  - "[[Personal]]"\n---\n'
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].kind).toBe('two-kinds');
		expect(findings[0].detail).toContain('Ferret Media');
		expect(findings[0].detail).toContain('Personal');
	});

	it('reports a task connected to two projects', async () => {
		const findings = await audit({
			'Tasks/Two.md':
				'---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['too-many-parents']);
	});

	it('reports the retired bucket flag without touching it', async () => {
		const findings = await audit({
			'Projects/Old Bucket.md':
				'---\ncategories:\n  - "[[Projects]]"\nbucket: true\nstatus: Idea\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['legacy-bucket-flag']);
		expect(findings[0].suggestion).toMatch(/remove it when convenient/);
	});

	it('reports an uncategorised note sitting in one of lull-pm folders', async () => {
		const findings = await audit({ 'Projects/Stray.md': '# Just some writing\n' });

		expect(findings.map((f) => f.kind)).toEqual(['uncategorised']);
		expect(findings[0].detail).toContain('Projects/');
	});

	it('reports an uncategorised main note anywhere, since ! means it is an entity', async () => {
		// Real note: Companies/lull-Software/lull.app/!lull.app.md has no frontmatter at all.
		const findings = await audit({
			'Companies/lull-Software/lull.app/!lull.app.md': '### Part of: [[lull]]\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['uncategorised']);
		expect(findings[0].title).toBe('lull.app');
	});

	it('leaves ordinary uncategorised writing alone', async () => {
		// The vault has 558 of these. None of them belong on this page.
		expect(await audit({ 'Notes/A thought I had.md': '# A thought\n' })).toEqual([]);
	});

	it('sorts blocking findings above notices', async () => {
		const findings = await audit({
			'Projects/Zebra.md': '---\ncategories: [[[Projects]]\n---\n',
			'Projects/Apple.md': '---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n'
		});

		expect(findings.map((f) => f.severity)).toEqual(['blocking', 'notice']);
	});

	it('never reports a template, which the vault excludes everywhere else too', async () => {
		expect(
			await audit({ 'Templates/Project Template.md': '---\ncategories: [[[x]]\n---\n' })
		).toEqual([]);
	});
});

describe('countByKind', () => {
	it('counts every kind, including the ones with no findings', async () => {
		const counts = countByKind(
			await audit({
				'Projects/Old.md': '---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n',
				'Projects/Stray.md': '# writing\n'
			})
		);

		expect(counts['legacy-bucket-flag']).toBe(1);
		expect(counts.uncategorised).toBe(1);
		expect(counts['two-kinds']).toBe(0);
	});
});
