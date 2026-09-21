import { describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { ProjectTypeService } from './ProjectTypeService';

/** Copied from the real vault's Templater config, trimmed to what matters here. */
const TEMPLATER = JSON.stringify({
	templates_folder: 'Templates',
	enable_folder_templates: true,
	folder_templates: [
		{ folder: '/', template: 'Templates/Default Template.md' },
		{ folder: 'Projects', template: 'Templates/Project Template.md' },
		{
			folder: 'Companies/TrueFerret (LLC)/Youtube Channels/TrueFerret/Videos',
			template: 'Templates/Content Project Template.md'
		},
		{ folder: '', template: '' }
	]
});

const PLAIN_TEMPLATE =
	'---\ncategories:\n  - "[[Projects]]"\norg:\nclients:\nstatus:\n---\n\n## Tasks\n';

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

function vault(files: Record<string, string> = {}) {
	return new MemoryVaultAdapter({
		'.obsidian/plugins/templater-obsidian/data.json': TEMPLATER,
		'Templates/Project Template.md': PLAIN_TEMPLATE,
		'Templates/Content Project Template.md': CONTENT_TEMPLATE,
		// Not a project template — must not become a type.
		'Templates/Task Template.md': '---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\n---\n',
		...files
	});
}

describe('listTypes', () => {
	it('finds a type per project template, named by its type property', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		expect(types.map((t) => t.name)).toEqual(['', 'Content']);
	});

	it('reads the pipeline the template declares', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		const content = types.find((t) => t.name === 'Content')!;

		expect(content.statuses).toEqual([
			'Idea',
			'Scripting',
			'Filming',
			'Editing',
			'Review',
			'Published'
		]);
	});

	it('treats the last status as finished when the template says nothing else', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		expect(types.find((t) => t.name === 'Content')!.terminal).toEqual(['Published']);
	});

	it('honours an explicit terminal list', async () => {
		const adapter = vault({
			'Templates/Content Project Template.md': CONTENT_TEMPLATE.replace(
				'status: Idea',
				'terminal: [Published, Abandoned]\nstatus: Idea'
			)
		});
		const types = await (await ProjectTypeService.open(adapter)).listTypes();
		expect(types.find((t) => t.name === 'Content')!.terminal).toEqual(['Published', 'Abandoned']);
	});

	it('gives a template with no statuses the default pipeline', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		expect(types.find((t) => t.name === '')!.statuses).toEqual([
			'Idea',
			'In Progress',
			'On Hold',
			'Done'
		]);
	});

	it('ignores templates that are not project templates', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		expect(types.map((t) => t.template)).not.toContain('Templates/Task Template.md');
	});

	it('reports the folders Templater maps to each type', async () => {
		const types = await (await ProjectTypeService.open(vault())).listTypes();
		expect(types.find((t) => t.name === 'Content')!.folders).toEqual([
			'Companies/TrueFerret (LLC)/Youtube Channels/TrueFerret/Videos'
		]);
	});

	it('falls back to one default type when there are no templates at all', async () => {
		const types = await (
			await ProjectTypeService.open(new MemoryVaultAdapter({ '.obsidian/app.json': '{}' }))
		).listTypes();

		expect(types).toHaveLength(1);
		expect(types[0].statuses).toContain('In Progress');
	});
});

describe('templateFor', () => {
	it('picks the most specific folder mapping, the way Templater does', async () => {
		const service = await ProjectTypeService.open(vault());
		expect(
			service.templateFor('Companies/TrueFerret (LLC)/Youtube Channels/TrueFerret/Videos')
		).toBe('Templates/Content Project Template.md');
	});

	it('falls back to a less specific mapping', async () => {
		const service = await ProjectTypeService.open(vault());
		expect(service.templateFor('Projects')).toBe('Templates/Project Template.md');
		expect(service.templateFor('Projects/Ferret Media')).toBe('Templates/Project Template.md');
	});

	it('uses the root catch-all for a folder nothing else matches', async () => {
		const service = await ProjectTypeService.open(vault());
		expect(service.templateFor('Notes')).toBe('Templates/Default Template.md');
	});

	it('returns nothing when folder templates are switched off', async () => {
		const adapter = vault({
			'.obsidian/plugins/templater-obsidian/data.json': TEMPLATER.replace(
				'"enable_folder_templates":true',
				'"enable_folder_templates":false'
			)
		});
		expect((await ProjectTypeService.open(adapter)).templateFor('Projects')).toBeNull();
	});
});
