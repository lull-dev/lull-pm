/**
 * A small stand-in vault, used when lull-pm runs in a plain browser tab with no filesystem to reach.
 *
 * It mirrors the shape of a real vault — Obsidian config, task/project templates, and a handful of
 * notes across a couple of "orgs" (the `org:` property lull-pm treats as a Bucket) — so `npm run dev`
 * exercises the same code paths the desktop build does. One task sits in each status, so every board
 * column and the Inbox page have something to show.
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

export function createSampleVault(): MemoryVaultAdapter {
	return new MemoryVaultAdapter(
		{
			'.obsidian/app.json': JSON.stringify({ newFileFolderPath: '_Inbox Notes' }),

			'Templates/Task Template.md': TASK_TEMPLATE,
			'Templates/Project Template.md': PROJECT_TEMPLATE,

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

			'Templates/Bases/Tasks.base': 'filters:\n  and:\n    - categories.contains(link("Tasks"))\n'
		},
		'Sample Vault'
	);
}
