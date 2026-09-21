/**
 * A small stand-in vault, used when lull-pm runs in a plain browser tab with no filesystem to reach.
 *
 * It mirrors the shape of a real vault — Obsidian config, task/project templates, and a handful of
 * notes across a couple of companies (the `org:` property) — so `npm run dev`
 * exercises the same code paths the desktop build does. One task sits in each status, so every board
 * column and the Inbox page have something to show, and three notes deliberately do not fit the
 * structure, so the Overview page shows findings rather than only its empty state.
 */

import { MemoryVaultAdapter } from './adapter.memory';

const TASK_TEMPLATE = `---
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

const PROJECT_TEMPLATE = `---
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
`;

/** A second project type, so the Settings page and the New project dialog have a choice to show. */
const CONTENT_PROJECT_TEMPLATE = `---
categories:
  - "[[Projects]]"
type: Content
statuses: [Idea, Scripting, Filming, Editing, Review, Published]
status: Idea
org:
content channel:
created: <% tp.date.now("YYYY-MM-DD") %>
---

## Script

## Shot list
`;

/** Mirrors the real vault's Templater setup: folder templates, enabled. */
const TEMPLATER_CONFIG = JSON.stringify({
	templates_folder: 'Templates',
	enable_folder_templates: true,
	folder_templates: [
		{ folder: 'Projects', template: 'Templates/Project Template.md' },
		{ folder: 'Projects/Videos', template: 'Templates/Content Project Template.md' }
	]
});

export function createSampleVault(): MemoryVaultAdapter {
	return new MemoryVaultAdapter(
		{
			'.obsidian/app.json': JSON.stringify({ newFileFolderPath: '_Inbox Notes' }),

			'Templates/Task Template.md': TASK_TEMPLATE,
			'Templates/Project Template.md': PROJECT_TEMPLATE,
			'Templates/Content Project Template.md': CONTENT_PROJECT_TEMPLATE,
			'.obsidian/plugins/templater-obsidian/data.json': TEMPLATER_CONFIG,

			'Projects/Marketing Website.md': `---
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
`,

			'Projects/lull.app.md': `---
categories:
  - "[[Projects]]"
org:
  - "[[lull]]"
clients:
status: In Progress
created: 2026-04-24
date: "[[2026-04-24]]"
start: 2026-04-24
end:
---

## Tasks
`,

			'Tasks/Design the new ASE button.md': `---
categories:
  - "[[Tasks]]"
status: Done
priority: High
org:
  - "[[Student Events]]"
projects:
  - "[[Marketing Website]]"
due: 2026-08-10
do: 2026-08-08
created: 2026-08-05
date: "[[2026-08-05]]"
done: 2026-08-09
---

## Why
So Silke can give feedback on the design before it gets built out.

## Steps
-  [x] Sketch the layout
-  [x] Pick colours

## Notes
`,

			'Tasks/Sketch the task board layout.md': `---
categories:
  - "[[Tasks]]"
status: In Progress
priority: Urgent
org:
  - "[[lull]]"
projects:
  - "[[lull.app]]"
due:
do: 2026-09-01
created: 2026-09-01
date: "[[2026-09-01]]"
done:
---

## Why
Need something to look at before wiring up real data.

## Steps
-  [x] Group by status
-  [ ] Add a priority badge
-  [ ] Add a due-date flag

## Notes
`,

			'Tasks/Draft the quarterly report.md': `---
categories:
  - "[[Tasks]]"
status: Unstarted
priority: Medium
org:
  - "[[lull]]"
projects:
due: 2026-09-20
do: 2026-09-18
created: 2026-09-05
date: "[[2026-09-05]]"
done:
---

## Why
Leadership wants numbers before the next planning cycle.

## Steps
-  [ ]

## Notes
`,

			'Tasks/Read Deep Work.md': `---
categories:
  - "[[Tasks]]"
status: Whenever
priority: Low
org:
projects:
due:
do:
created: 2026-08-20
date: "[[2026-08-20]]"
done:
---

## Why
No rush, just want to get to it eventually.

## Steps
-  [ ]

## Notes
`,

			'Tasks/Buy groceries.md': `---
categories:
  - "[[Tasks]]"
status: Inbox
priority: Low
org:
bucket:
  - "[[Personal]]"
projects:
due:
do:
created: 2026-09-05
date: "[[2026-09-05]]"
done:
---

## Why

## Steps
-  [ ] Milk
-  [ ] Eggs

## Notes
`,

			'Companies/lull-Software/lull.md': `---
categories:
  - "[[Categories/Companies|Companies]]"
created: 2026-01-10
---

## Projects
`,

			'Goals/Ship lull-pm 1.0.md': `---
categories:
  - "[[Goals]]"
status: In Progress
org:
  - "[[lull]]"
created: 2026-09-01
---
`,

			'Categories/Buckets/Personal.md': `---
categories:
  - "[[Buckets]]"
created: 2026-04-01
---
`,

			'Categories/Buckets/Work.md': `---
categories:
  - "[[Buckets]]"
created: 2026-04-01
---
`,

			/* --- Notes that deliberately do not fit, so the Overview page shows its real state --- */

			// Connected to a company and a bucket at once. The rule says one or the other.
			'Projects/Rebrand.md': `---
categories:
  - "[[Projects]]"
org:
  - "[[lull]]"
bucket:
  - "[[Personal]]"
status: Idea
created: 2026-09-01
---

## Tasks
`,

			// A folder's main note with no frontmatter at all — the `!lull.app.md` case.
			'Projects/Podcast/!Podcast.md': `### Part of: [[Ferret Media]]

Episode ideas live here.
`,

			// Still carrying the retired flag from when a bucket was a property of a project.
			'Projects/Side Quests.md': `---
categories:
  - "[[Projects]]"
bucket: true
status: In Progress
created: 2026-07-01
---
`,

			'Templates/Bases/Tasks.base': 'filters:\n  and:\n    - categories.contains(link("Tasks"))\n'
		},
		'Sample Vault'
	);
}
