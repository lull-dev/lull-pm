import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { GoalService } from './GoalService';

const GOAL = `---
categories:
  - "[[Goals]]"
status: In Progress
org:
  - "[[Ferret Media]]"
created: 2026-09-01
---
`;

let adapter: MemoryVaultAdapter;
let service: GoalService;

beforeEach(async () => {
	adapter = new MemoryVaultAdapter({
		'.obsidian/app.json': '{}',
		'Goals/Ship lull-pm.md': GOAL,
		'Projects/Marketing Website.md': '---\ncategories:\n  - "[[Projects]]"\n---\n'
	});
	service = await GoalService.open(adapter);
});

async function goals() {
	return service.listGoals(await indexVault(adapter));
}

describe('reading', () => {
	it('lists goals by category', async () => {
		expect((await goals()).map((g) => g.name)).toEqual(['Ship lull-pm']);
	});

	it('reads org as the company a goal belongs to', async () => {
		const goal = await service.readGoal('Goals/Ship lull-pm.md');
		expect(goal.parent).toEqual({ kind: 'company', name: 'Ferret Media' });
		expect(goal.status).toBe('In Progress');
	});

	it('does not confuse a project for a goal', async () => {
		expect((await goals()).map((g) => g.name)).not.toContain('Marketing Website');
	});

	it('reads a status the vault wrote as a list', async () => {
		await adapter.write(
			'Goals/Listed.md',
			'---\ncategories:\n  - "[[Goals]]"\nstatus:\n  - Idea\n---\n'
		);
		expect((await service.readGoal('Goals/Listed.md')).status).toBe('Idea');
	});
});

describe('creating', () => {
	it('creates a goal connected to a bucket', async () => {
		const goal = await service.createGoal('Learn Rust', {
			status: 'Idea',
			parent: { kind: 'bucket', name: 'Personal' },
			today: new Date('2026-09-19T12:00:00')
		});

		expect(goal.path).toBe('Goals/Learn Rust.md');
		expect(goal.parent).toEqual({ kind: 'bucket', name: 'Personal' });
		expect(await adapter.read(goal.path)).toBe(
			'---\ncategories:\n  - "[[Goals]]"\nstatus: Idea\ncreated: 2026-09-19\nbucket:\n  - "[[Personal]]"\n---\n'
		);
	});

	it('creates a goal with no connection at all', async () => {
		const goal = await service.createGoal('Someday', { today: new Date('2026-09-19T12:00:00') });
		expect(goal.parent).toBeNull();
		expect(await adapter.read(goal.path)).not.toContain('bucket:');
	});

	it('refuses to connect a goal to a project', async () => {
		await expect(
			service.createGoal('Wrong', { parent: { kind: 'project', name: 'Marketing Website' } })
		).rejects.toThrow(/goal cannot be connected to a project/);
	});

	it('refuses an empty name', async () => {
		await expect(service.createGoal('  ')).rejects.toThrow(/needs a name/);
	});
});

describe('editing', () => {
	const path = 'Goals/Ship lull-pm.md';

	it('changes status', async () => {
		expect((await service.setStatus(path, 'Done')).status).toBe('Done');
	});

	it('only rewrites the bytes that changed', async () => {
		const before = await adapter.read(path);
		await service.setStatus(path, 'In Progress');
		expect(await adapter.read(path)).toBe(before);
	});

	it('moves a goal from a company to a bucket, clearing the company', async () => {
		const goal = await service.setParent(path, { kind: 'bucket', name: 'Personal' });

		expect(goal.parent).toEqual({ kind: 'bucket', name: 'Personal' });
		expect(goal.parentViolation).toBeNull();
		expect(await adapter.read(path)).not.toContain('Ferret Media');
	});
});
