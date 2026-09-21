import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
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

describe('reading', () => {
	it('parses frontmatter off a real project note', async () => {
		const project = await service.readProject('Projects/Marketing Website.md');

		expect(project.name).toBe('Marketing Website');
		expect(project.status).toBe('In Progress');
	});

	it('lists every project in the folder except the template', async () => {
		const projects = await service.listProjects();
		expect(projects.map((p) => p.name)).toEqual(['Marketing Website']);
	});

	it('defaults to an empty status for a note missing it', async () => {
		await adapter.write('Projects/Bare.md', '---\ncreated: 2026-01-01\n---\n');
		const project = await service.readProject('Projects/Bare.md');
		expect(project.status).toBe('');
	});

	it('defaults bucket to false for a note missing the flag', async () => {
		const project = await service.readProject('Projects/Marketing Website.md');
		expect(project.bucket).toBe(false);
	});

	it('reads bucket: true off a note that has it', async () => {
		await adapter.write('Projects/Personal.md', '---\nbucket: true\n---\n');
		const project = await service.readProject('Projects/Personal.md');
		expect(project.bucket).toBe(true);
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

	it('applies bucket: true on creation', async () => {
		const project = await service.createProject('Personal', {
			bucket: true,
			today: new Date('2026-09-08T12:00:00')
		});

		expect(project.bucket).toBe(true);
	});

	it('defaults bucket to false when not given', async () => {
		const project = await service.createProject('Work', { today: new Date('2026-09-08T12:00:00') });
		expect(project.bucket).toBe(false);
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

	it('flips a project into a bucket and back', async () => {
		expect((await service.setBucket(path, true)).bucket).toBe(true);
		expect((await service.setBucket(path, false)).bucket).toBe(false);
	});
});
