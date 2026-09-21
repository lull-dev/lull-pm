import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { TaskService } from './TaskService';

/** Copied verbatim from the real vault's Templates/Task Template.md, plus the new `do:` property. */
const TEMPLATE = `---
categories:
  - "[[Tasks]]"
status: Inbox
priority: Medium
org:
projects:
due:
do:
created: <% tp.date.now("YYYY-MM-DD") %>
date: "[[<% tp.date.now('YYYY-MM-DD') %>]]"
done:
---

## Why



## Steps
-  [ ]


## Notes
`;

/** Copied verbatim from a real task note in the vault, with `status: Todo` renamed to `Unstarted`. */
const REAL_TASK = `---
categories:
  - "[[Tasks]]"
status: Unstarted
priority: High
org:
  - "[[Student Events]]"
projects:
  - "[[Marketing-Website student events]]"
due:
do: 2026-08-18
created: 2026-08-14
date: "[[2026-08-14]]"
done:
---

## Why
So Silke can give feedback on the design before it gets built out.

## Steps
-  [x] Design the new ASE button
-  [ ] App en contact knopjes met icoontjes
-  [ ] Feestjes, dozen beetje transparant
-  [ ] Spacing nakijken


## Notes
Source: [[All TODOs]] → Marketing Website ASE
`;

function vault() {
	return new MemoryVaultAdapter(
		{
			'Templates/Task Template.md': TEMPLATE,
			'Tasks/Convert ASE Marketing Website to Figma.md': REAL_TASK,
			'.obsidian/app.json': '{}'
		},
		'TrueFerret-Vault'
	);
}

let adapter: MemoryVaultAdapter;
let service: TaskService;

beforeEach(async () => {
	adapter = vault();
	service = await TaskService.open(adapter);
});

describe('reading', () => {
	it('parses frontmatter, sections and steps off a real task note', async () => {
		const task = await service.readTask('Tasks/Convert ASE Marketing Website to Figma.md');

		expect(task.name).toBe('Convert ASE Marketing Website to Figma');
		expect(task.status).toBe('Unstarted');
		expect(task.priority).toBe('High');
		expect(task.org).toEqual(['Student Events']);
		expect(task.projects).toEqual(['Marketing-Website student events']);
		expect(task.due).toBeNull();
		expect(task.doDate).toBe('2026-08-18');
		expect(task.why).toContain('Silke can give feedback');
		expect(task.notes).toContain('All TODOs');
		expect(task.steps).toHaveLength(4);
		expect(task.steps[0].state).toBe('x');
		expect(task.steps[0].text).toBe('Design the new ASE button');
		expect(task.steps[1].state).toBe(' ');
	});

	it('lists tasks by category, not by folder', async () => {
		const tasks = service.listTasks(await indexVault(adapter));
		expect(tasks.map((t) => t.name)).toEqual(['Convert ASE Marketing Website to Figma']);
	});

	it('ignores a note in Tasks/ that claims no category', async () => {
		await adapter.write('Tasks/Scratch.md', '# Just writing\n');
		const tasks = service.listTasks(await indexVault(adapter));
		expect(tasks.map((t) => t.name)).not.toContain('Scratch');
	});

	it('defaults status and priority for a note missing them', async () => {
		await adapter.write('Tasks/Bare.md', '---\ncreated: 2026-01-01\n---\n');
		const task = await service.readTask('Tasks/Bare.md');
		expect(task.status).toBe('Inbox');
		expect(task.priority).toBe('Medium');
	});

	it('falls back to Inbox for a status the vault no longer uses', async () => {
		await adapter.write('Tasks/Legacy.md', '---\nstatus: Blocked\n---\n');
		const task = await service.readTask('Tasks/Legacy.md');
		expect(task.status).toBe('Inbox');
	});
});

describe('creating', () => {
	it('creates a task from the real template, with the given title', async () => {
		const today = new Date('2026-09-08T12:00:00');
		const task = await service.createTask('Ship the task board', { today });

		expect(task.path).toBe('Tasks/Ship the task board.md');
		expect(task.status).toBe('Inbox');
		expect(task.priority).toBe('Medium');
		expect(task.created).toBe('2026-09-08');
	});

	it('applies the given priority, org, projects, due and do date on creation', async () => {
		const task = await service.createTask('Prioritised task', {
			priority: 'Urgent',
			org: ['lull'],
			projects: ['lull.app'],
			due: '2026-09-20',
			doDate: '2026-09-18',
			today: new Date('2026-09-08T12:00:00')
		});

		expect(task.priority).toBe('Urgent');
		expect(task.org).toEqual(['lull']);
		expect(task.projects).toEqual(['lull.app']);
		expect(task.due).toBe('2026-09-20');
		expect(task.doDate).toBe('2026-09-18');
	});

	it('refuses to overwrite an existing task', async () => {
		await service.createTask('Duplicate', { today: new Date('2026-01-01') });
		await expect(
			service.createTask('Duplicate', { today: new Date('2026-01-01') })
		).rejects.toThrow();
	});
});

describe('status', () => {
	const path = 'Tasks/Convert ASE Marketing Website to Figma.md';

	it('stamps done with today when moved to Done', async () => {
		const task = await service.setStatus(path, 'Done', new Date('2026-09-08T12:00:00'));
		expect(task.status).toBe('Done');
		expect(task.done).toBe('2026-09-08');
	});

	it('does not overwrite an existing done date', async () => {
		await adapter.write(
			path,
			REAL_TASK.replace('status: Unstarted', 'status: In Progress').replace(
				'done:\n',
				'done: 2026-08-20\n'
			)
		);
		const task = await service.setStatus(path, 'Done', new Date('2026-09-08T12:00:00'));
		expect(task.done).toBe('2026-08-20');
	});

	it('clears done when moved away from Done', async () => {
		await service.setStatus(path, 'Done', new Date('2026-09-08T12:00:00'));
		const task = await service.setStatus(path, 'In Progress');
		expect(task.status).toBe('In Progress');
		expect(task.done).toBeNull();
	});

	it('only rewrites the bytes that changed', async () => {
		const before = await adapter.read(path);
		await service.setPriority(path, 'High'); // already High — should be a no-op
		expect(await adapter.read(path)).toBe(before);
	});
});

describe('dates', () => {
	const path = 'Tasks/Convert ASE Marketing Website to Figma.md';

	it('sets the do date independently of due', async () => {
		const task = await service.setDoDate(path, '2026-08-25');
		expect(task.doDate).toBe('2026-08-25');
		expect(task.due).toBeNull();
	});

	it('sets due independently of do date', async () => {
		const task = await service.setDue(path, '2026-09-01');
		expect(task.due).toBe('2026-09-01');
		expect(task.doDate).toBe('2026-08-18');
	});

	it('clears a date back to unset', async () => {
		const task = await service.setDoDate(path, null);
		expect(task.doDate).toBeNull();
	});
});

describe('steps', () => {
	const path = 'Tasks/Convert ASE Marketing Website to Figma.md';

	it('toggles a step by index without touching the others', async () => {
		const task = await service.toggleStep(path, 1);
		expect(task.steps[0].state).toBe('x'); // untouched
		expect(task.steps[1].state).toBe('x'); // toggled on
		expect(task.steps[2].state).toBe(' ');
	});

	it('toggling twice returns to the original state', async () => {
		const before = await adapter.read(path);
		await service.toggleStep(path, 1);
		await service.toggleStep(path, 1);
		expect(await adapter.read(path)).toBe(before);
	});

	it('adds a new step to the end of the Steps section', async () => {
		const task = await service.addStep(path, 'Get sign-off');
		expect(task.steps).toHaveLength(5);
		expect(task.steps[4].text).toBe('Get sign-off');
		expect(task.steps[4].state).toBe(' ');
	});

	it('creates a Steps section when the note has none', async () => {
		await adapter.write('Tasks/No Steps.md', '---\nstatus: Inbox\n---\n\n## Why\nBecause.\n');
		const task = await service.addStep('Tasks/No Steps.md', 'First step');
		expect(task.steps).toHaveLength(1);
		expect(task.steps[0].text).toBe('First step');
	});
});

describe('body sections', () => {
	const path = 'Tasks/Convert ASE Marketing Website to Figma.md';

	it('replaces Why without touching Steps or Notes', async () => {
		const task = await service.setWhy(path, 'A new reason.');
		expect(task.why).toBe('A new reason.');
		expect(task.steps).toHaveLength(4);
		expect(task.notes).toContain('All TODOs');
	});

	it('creates a Notes section when the note has none', async () => {
		await adapter.write('Tasks/No Notes.md', '---\nstatus: Inbox\n---\n\n## Why\nBecause.\n');
		const task = await service.setNotes('Tasks/No Notes.md', 'Some context.');
		expect(task.notes).toBe('Some context.');
	});
});

describe('TaskService parents', () => {
	const path = 'Tasks/Convert ASE Marketing Website to Figma.md';

	it('reads the project a task is connected to, and not its org', async () => {
		const service = await TaskService.open(vault());
		const task = await service.readTask(path);

		// The note carries both keys, as real task notes do. Only `projects` is the parent: `org`
		// is the company, and a task's company follows from its project.
		expect(task.parent).toEqual({ kind: 'project', name: 'Marketing-Website student events' });
		expect(task.org).toEqual(['Student Events']);
		expect(task.parentViolation).toBeNull();
	});

	it('moving a task to a bucket clears its project, and the reverse', async () => {
		const adapter = vault();
		const service = await TaskService.open(adapter);

		const moved = await service.setParent(path, { kind: 'bucket', name: 'Personal' });
		expect(moved.parent).toEqual({ kind: 'bucket', name: 'Personal' });
		expect(moved.projects).toEqual([]);
		expect(moved.parentViolation).toBeNull();

		const back = await service.setParent(path, {
			kind: 'project',
			name: 'Marketing-Website student events'
		});
		expect(back.parent).toEqual({ kind: 'project', name: 'Marketing-Website student events' });
		expect(await adapter.read(path)).not.toContain('[[Personal]]');
	});

	it('leaves the company on org when the parent changes', async () => {
		const adapter = vault();
		await (await TaskService.open(adapter)).setParent(path, { kind: 'bucket', name: 'Personal' });

		// Rewriting a property the user maintains by hand is not lull-pm's to do.
		expect(await adapter.read(path)).toContain('org:\n  - "[[Student Events]]"');
	});

	it('disconnects a task entirely', async () => {
		const adapter = vault();
		const task = await (await TaskService.open(adapter)).setParent(path, null);

		expect(task.parent).toBeNull();
		expect(await adapter.read(path)).toContain('do: 2026-08-18');
	});

	it('refuses to connect a task to a company', async () => {
		const service = await TaskService.open(vault());
		await expect(
			service.setParent(path, { kind: 'company', name: 'Ferret Media' })
		).rejects.toThrow(/cannot be connected to a company/);
	});

	it('flags a task that breaks the rule instead of silently picking one', async () => {
		const adapter = vault();
		await adapter.write(
			'Tasks/Broken.md',
			'---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\nprojects:\n  - "[[A]]"\n' +
				'bucket:\n  - "[[Personal]]"\n---\n'
		);
		const task = await (await TaskService.open(adapter)).readTask('Tasks/Broken.md');

		expect(task.parentViolation).toBe('two-kinds');
		expect(task.parent).toEqual({ kind: 'project', name: 'A' });
	});

	it('flags a task connected to two projects', async () => {
		const adapter = vault();
		await adapter.write(
			'Tasks/Two.md',
			'---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n---\n'
		);
		const task = await (await TaskService.open(adapter)).readTask('Tasks/Two.md');

		expect(task.parentViolation).toBe('too-many');
	});

	it('creates a task already connected to a bucket', async () => {
		const service = await TaskService.open(vault());
		const task = await service.createTask('Buy milk', {
			parent: { kind: 'bucket', name: 'Personal' }
		});

		expect(task.parent).toEqual({ kind: 'bucket', name: 'Personal' });
	});
});
