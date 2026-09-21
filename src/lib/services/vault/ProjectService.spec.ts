import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { ProjectService } from './ProjectService';

/** Copied verbatim from the real vault's Templates/Project Template.md. */
const TEMPLATE = `---
categories:
  - "[[Projects]]"
org:
clients:
status:
created: <% tp.date.now("YYYY-MM-DD") %>
date: "[[<% tp.date.now('YYYY-MM-DD') %>]]"
start:
end:
---

## Tasks
![[Tasks.base#Project Tasks]]
`;

/** Copied verbatim from a real project note in the vault. */
const REAL_PROJECT = `---
categories:
  - "[[Projects]]"
org:
  - "[[Student Events]]"
clients:
status: In Progress
created: 2026-08-01
date: "[[2026-08-01]]"
start: 2026-08-01
end:
---

## Tasks
![[Tasks.base#Project Tasks]]
`;

function vault() {
	return new MemoryVaultAdapter(
		{
			'Templates/Project Template.md': TEMPLATE,
			'Projects/Marketing Website.md': REAL_PROJECT,
			'.obsidian/app.json': '{}'
		},
		'TrueFerret-Vault'
	);
}

let adapter: MemoryVaultAdapter;
let service: ProjectService;

beforeEach(async () => {
	adapter = vault();
	service = await ProjectService.open(adapter);
});

/** What the manager does: build the index, then read projects out of it. */
async function projects() {
	return service.listProjects(await indexVault(adapter));
}

describe('reading', () => {
	it('parses frontmatter off a real project note', async () => {
		const project = await service.readProject('Projects/Marketing Website.md');

		expect(project.name).toBe('Marketing Website');
		expect(project.status).toBe('In Progress');
	});

	it('lists projects by category, not by folder', async () => {
		expect((await projects()).map((p) => p.name)).toEqual(['Marketing Website']);
	});

	it('finds a project that lives outside Projects/ entirely', async () => {
		// The real vault has exactly this: Companies/lull-Software/lull.app/!lull.app.md. A folder
		// scan of Projects/ would never see it.
		await adapter.write(
			'Companies/lull-Software/lull.app/!lull.app.md',
			'---\ncategories:\n  - "[[Projects]]"\nstatus: In Progress\n---\n'
		);
		// The bang is Obsidian's file-list sorting device, not part of the title.
		expect((await projects()).map((p) => p.name)).toContain('lull.app');
	});

	it('ignores a note in Projects/ that claims no category', async () => {
		await adapter.write('Projects/Stray thought.md', '# Just writing\n');
		expect((await projects()).map((p) => p.name)).not.toContain('Stray thought');
	});

	it('excludes templates, the rule every .base already applies', async () => {
		expect((await projects()).map((p) => p.name)).not.toContain('Project Template');
	});

	it('defaults to an empty status for a note missing it', async () => {
		await adapter.write('Projects/Bare.md', '---\ncreated: 2026-01-01\n---\n');
		const project = await service.readProject('Projects/Bare.md');
		expect(project.status).toBe('');
	});
});

describe('creating', () => {
	it('creates a project from the real template, with the given title', async () => {
		const today = new Date('2026-09-08T12:00:00');
		const project = await service.createProject('lull.app', { today });

		expect(project.path).toBe('Projects/lull.app.md');
		expect(project.status).toBe('');
		expect(project.created).toBe('2026-09-08');
	});

	it('applies the given status on creation', async () => {
		const project = await service.createProject('New project', {
			status: 'Idea',
			today: new Date('2026-09-08T12:00:00')
		});

		expect(project.status).toBe('Idea');
	});

	it('refuses to overwrite an existing project', async () => {
		await service.createProject('Duplicate', { today: new Date('2026-01-01') });
		await expect(
			service.createProject('Duplicate', { today: new Date('2026-01-01') })
		).rejects.toThrow();
	});
});

describe('editing', () => {
	const path = 'Projects/Marketing Website.md';

	it('changes status', async () => {
		const project = await service.setStatus(path, 'On Hold');
		expect(project.status).toBe('On Hold');
	});

	it('only rewrites the bytes that changed', async () => {
		const before = await adapter.read(path);
		await service.setStatus(path, 'In Progress'); // already In Progress — should be a no-op
		expect(await adapter.read(path)).toBe(before);
	});
});

describe('ProjectService parents', () => {
	it('reads org as the company a project belongs to', async () => {
		const service = await ProjectService.open(vault());
		const project = await service.readProject('Projects/Marketing Website.md');

		expect(project.parent).toEqual({ kind: 'company', name: 'Student Events' });
		expect(project.parentViolation).toBeNull();
	});

	it('reads a status the vault wrote as a list', async () => {
		const adapter = vault();
		await adapter.write(
			'Projects/Short - Lighting is everything.md',
			'---\ncategories:\n  - "[[Projects]]"\norg:\n  - "[[Ferret Media]]"\nstatus:\n  - Idea\n---\n'
		);
		const service = await ProjectService.open(adapter);

		expect((await service.readProject('Projects/Short - Lighting is everything.md')).status).toBe(
			'Idea'
		);
	});

	it('moves a project from a company to a bucket, clearing the company', async () => {
		const adapter = vault();
		const service = await ProjectService.open(adapter);
		const project = await service.setParent('Projects/Marketing Website.md', {
			kind: 'bucket',
			name: 'Personal'
		});

		expect(project.parent).toEqual({ kind: 'bucket', name: 'Personal' });

		const raw = await adapter.read('Projects/Marketing Website.md');
		expect(raw).toContain('bucket:\n  - "[[Personal]]"');
		expect(raw).not.toContain('Student Events');
	});

	it('changes only the two keys the rule owns, byte for byte', async () => {
		const adapter = vault();
		const service = await ProjectService.open(adapter);
		await service.setParent('Projects/Marketing Website.md', { kind: 'bucket', name: 'Personal' });

		// Spelled out rather than diffed, because "only these bytes moved" is the whole claim.
		expect(await adapter.read('Projects/Marketing Website.md')).toBe(
			`---
categories:
  - "[[Projects]]"
org:
clients:
status: In Progress
created: 2026-08-01
date: "[[2026-08-01]]"
start: 2026-08-01
end:
bucket:
  - "[[Personal]]"
---

## Tasks
![[Tasks.base#Project Tasks]]
`
		);
	});

	it('creates a project already connected to a company', async () => {
		const service = await ProjectService.open(vault());
		const project = await service.createProject('Website Ferret Media', {
			parent: { kind: 'company', name: 'Ferret Media' }
		});

		expect(project.parent).toEqual({ kind: 'company', name: 'Ferret Media' });
	});

	it('refuses to connect a project to another project', async () => {
		const service = await ProjectService.open(vault());
		await expect(
			service.setParent('Projects/Marketing Website.md', { kind: 'project', name: 'Other' })
		).rejects.toThrow(/cannot be connected to a project/);
	});

	it('disconnects a project without disturbing its other properties', async () => {
		const adapter = vault();
		const service = await ProjectService.open(adapter);
		const project = await service.setParent('Projects/Marketing Website.md', null);

		expect(project.parent).toBeNull();
		expect(project.status).toBe('In Progress');
		expect(await adapter.read('Projects/Marketing Website.md')).toContain('start: 2026-08-01');
	});
});

describe('project types', () => {
	const CONTENT_TEMPLATE = `---
categories:
  - "[[Projects]]"
type: Content
statuses: [Idea, Scripting, Filming, Editing, Review, Published]
status: Idea
content channel:
---

## Script
`;

	function typedVault() {
		return new MemoryVaultAdapter({
			'.obsidian/plugins/templater-obsidian/data.json': JSON.stringify({
				templates_folder: 'Templates',
				enable_folder_templates: true,
				folder_templates: [
					{ folder: 'Projects', template: 'Templates/Project Template.md' },
					{ folder: 'Projects/Videos', template: 'Templates/Content Project Template.md' }
				]
			}),
			'Templates/Project Template.md': TEMPLATE,
			'Templates/Content Project Template.md': CONTENT_TEMPLATE
		});
	}

	it('builds a new project from the template Templater maps its folder to', async () => {
		const adapter = typedVault();
		const service = await ProjectService.open(adapter);
		const project = await service.createProject('Why you wont lose your job to AI', {
			folder: 'Projects/Videos',
			today: new Date('2026-09-19T12:00:00')
		});

		expect(project.type).toBe('Content');
		expect(project.status).toBe('Idea');
		expect(await adapter.read(project.path)).toContain('## Script');
	});

	it('strips statuses from the created note, keeping only its type', async () => {
		const adapter = typedVault();
		const service = await ProjectService.open(adapter);
		const project = await service.createProject('Short - Lighting', { folder: 'Projects/Videos' });
		const raw = await adapter.read(project.path);

		// The pipeline belongs to the template. Copying it into every note would let the copies drift.
		expect(raw).not.toContain('statuses:');
		expect(raw).toContain('type: Content');
	});

	it('uses the plain project template for a folder mapped to it', async () => {
		const adapter = typedVault();
		const service = await ProjectService.open(adapter);
		const project = await service.createProject('Website', { folder: 'Projects' });

		expect(project.type).toBe('');
		expect(await adapter.read(project.path)).toContain('## Tasks');
	});

	it('takes an explicit template over the folder mapping', async () => {
		const adapter = typedVault();
		const service = await ProjectService.open(adapter);
		const project = await service.createProject('Explicit', {
			template: 'Templates/Content Project Template.md'
		});

		expect(project.type).toBe('Content');
	});

	it('reads the type off an existing note', async () => {
		const adapter = typedVault();
		await adapter.write(
			'Projects/Existing.md',
			'---\ncategories:\n  - "[[Projects]]"\ntype: Content\nstatus: Filming\n---\n'
		);
		const project = await (await ProjectService.open(adapter)).readProject('Projects/Existing.md');

		expect(project.type).toBe('Content');
		expect(project.status).toBe('Filming');
	});
});
