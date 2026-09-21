# Vault structure, four note types, and project templates

The plan lull-pm is being rebuilt against. Grounded in `~/coding-projects/lull/lull-vault-dev`,
not in guesses about how an Obsidian vault "should" be laid out.

## What the vault actually does

Four findings, each of which contradicts something lull-pm currently believes:

1. **Note type is `categories:`, not the folder.** `Templates/Bases/Projects.base` filters on
   `categories.contains(link("Projects"))`; Tasks.base and Companies.base do the same. lull-pm
   scans `Projects/` recursively and calls every file a project, which misses
   `Companies/lull-Software/lull.app/!lull.app.md` entirely.

2. **The main note of a folder is `!`-prefixed** — `Projects/Dark Vibrance/!Dark Vibrance.md`,
   `Companies/lull-Software/lull.app/!lull.app.md` — not named after its folder. Company main notes
   are the exception: `Companies/Ferret Media (Zelfstandig)/Ferret Media.md` has no bang and does
   not match its folder name.

3. **`org:` already holds companies.** Tasks carry `[[Schneider Electric]]`, `[[Ferret Media]]`,
   `[[Student Events]]`; projects the same. So "`org:` means Company" needs zero note rewriting —
   only lull-pm's labelling was ever wrong. The README's claim that `org` means Bucket is the thing
   that is untrue.

4. **`status:` is a YAML list**, which is why the bases use `status.contains(...)`.
   `getString(note, 'status')` cannot read it.

And Templater is already configured with `enable_folder_templates: true` and a `Projects →
Templates/Project Template.md` mapping. That is the hook project types hang off.

## Rules this implements

- A Project is connected to a Bucket **or** a Company — never both.
- A Task is connected to a Bucket **or** a Project — never both.
- A Goal is connected to a Bucket **or** a Company — never both.
- Exactly one parent, never two of the same kind.

## The rule above every other rule

**lull-pm does not change files the user made.** The vault is written by hand, over years, in
whatever shape made sense at the time. lull-pm is a lens on it, not an authority over it.

So there is no migration, no sweep, no "tidy up to match the structure". A pass that rewrote 558
notes into lull-pm's preferred shape would be the most destructive thing this app could do, and it
would do it silently, to files nobody asked it to touch.

lull-pm still writes — a status change, a new task, a parent picked from a dropdown. The difference
is that every one of those is something the user just asked for, on the note they were looking at.

What it does instead is **show** them: `/overview` lists every note lull-pm could not place and says
why, in their terms, with each one a click away in Obsidian. Reported, never repaired.

## What lull-pm may create

lull-pm creates **note folders** — `Categories/Buckets/`, `Goals/` — because it writes notes into
them. It does **not** create category notes (`Categories/Buckets.md`), `.base` files, or note
templates. Those are authored by hand in Obsidian, and lull-pm reads whatever is there. A missing
category note is not an error: `categories: [[Buckets]]` is simply an unresolved wikilink until one
is written, which is ordinary Obsidian behaviour.

---

## Phase 0 — Read the vault the way the vault reads itself ✅

The prerequisite for everything else. Without it, Companies and folder-per-project cannot be found.

- `src/lib/vault/categories.ts` (new) — resolve `categories:` links to bare names, handling all
  three forms in the vault: `"[[Projects]]"`, `"[[Categories/Companies|Companies]]"`, and absent.
  `categoryNames(note)` and `hasCategory(note, 'Projects')`.
- `frontmatter.ts` — add `getScalar(note, key)`: one string whether the value is `status: Idea` or
  `status:\n  - Idea`. Writes preserve whichever shape the note already uses, so a list-valued
  `status` stays a list.
- `src/lib/vault/notes.ts` (new) — `listNotesByCategory(adapter, 'Projects')` walks the vault once,
  parses frontmatter, and buckets notes by category. Replaces the per-folder `list()` in both
  services. Folders become a default for new notes, not the definition of a type.
- **Main-note resolution** — a note is a main note if its basename starts with `!`, or it is the
  only categorised note in its folder, or its basename matches the folder. Sub-notes in the same
  folder attach as children. Flat notes stay projects with no folder. Nothing moves on disk.
- `settings.ts` — `readTemplaterConfig(adapter)`, reading
  `.obsidian/plugins/templater-obsidian/data.json` read-only, the way `readAppSettings` already
  reads `app.json`. Exposes `templates_folder`, `folder_templates`, `enable_folder_templates`, and
  retires the hardcoded `'Templates/Project Template.md'` in both services.

Done when `npm test` is green and `LULL_VAULT=~/TrueFerret-Vault npm test` reports how many notes of
each category it found and which are unclassified. `!lull.app.md` has no frontmatter at all, so it
appears in that list rather than being silently invented into a project.

## Phase 1 — The parent link, and the XOR rule ✅

| Type    | Parent is          | Keys                      |
| ------- | ------------------ | ------------------------- |
| Project | Bucket xor Company | `bucket:` xor `org:`      |
| Task    | Bucket xor Project | `bucket:` xor `projects:` |
| Goal    | Bucket xor Company | `bucket:` xor `org:`      |

- `src/lib/models/Parent.ts` (new) —
  `type Parent = { kind: 'bucket' | 'company' | 'project'; name: string } | null`. A discriminated
  union in TypeScript; two keys on disk.
- **Atomic writes.** Setting a parent is a single
  `setFrontmatterValues(raw, { bucket: x, org: null })`, so the note never exists on disk in a state
  that violates the rule. `editNote`'s retry loop then makes it concurrency-safe.
- **Conflicts surface, they do not resolve silently.** A note with both is read as the more specific
  kind (project over bucket) and flagged in the UI with a one-click fix.
- Keys stay YAML lists on disk because `.base` uses `.contains()`; lull-pm just never writes more
  than one entry.
- Tasks that carry both `org:` and `projects:` today keep their `org:` untouched. Company is
  displayed as derived from the project. lull-pm does not auto-sync `org:` — that would be writing
  data nobody asked for.
- **Link shape is preserved.** Five notes write `org:` as a path-qualified link
  (`"[[Companies/Taboen Gang/Taboen Gang|Taboen Gang]]"`, `"[[Notes/KdG]]"`). Those already resolve
  where they should, so an unchanged parent leaves their bytes alone rather than flattening them to
  a bare `[[Taboen Gang]]`. Links compare by basename, the way Obsidian resolves them.

## Phase 2 — Buckets become real notes ✅

Reverses commit `0ca8700` ("Make buckets a flag on projects").

- Bucket notes live in `Categories/Buckets/` with `categories: [[Buckets]]`. lull-pm creates the
  folder; the `Categories/Buckets.md` category note and any `.base` file are written by hand.
- `src/lib/models/Bucket.ts` — rewritten from "distinct `org` value" to a real note with `path`,
  `name`, `created`.
- `src/lib/services/vault/BucketService.ts` and `BucketManager.svelte.ts` (new), plus
  `NewBucketDialog.svelte`. `/buckets` is its own page, not a filtered view of Projects.
- **Phase 0's index finally wired in.** The services had still been listing by folder; they now read
  by category out of one shared snapshot (`IndexManager`), rather than four services each walking
  1386 notes. `listProjects`/`listTasks`/`listBuckets` are synchronous — the index already holds
  every note parsed.
- `Project.bucket: boolean`, `ProjectService.setBucket` and `NewProjectDialog`'s `kind="bucket"` are
  deleted. `/buckets` is backed by BucketService.
- A project still carrying `bucket: true` is **reported on `/overview`** and otherwise ignored.
  lull-pm does not convert it, offer to convert it, or read it as a bucket — the flag is dead, and
  removing it is the user's call, made in Obsidian.

## Phase 3 — Companies and Goals ✅

- `src/lib/models/Company.ts`, `CompanyService.ts`, `CompanyManager.svelte.ts`, route `/companies`.
  Read by `categories: [[Companies]]`, which finds all **eight** — including two that do not live
  under `Companies/` at all: `Schneider Electric/Schneider Electric.md` and
  `References/Karel de Grote Hogeschool.md`. Both are load-bearing (`Projects.base` filters on
  `org.contains(link("Schneider Electric"))`), and a folder scan would have silently lost them.
  Each card shows the company's projects and goals.
- **Companies are read-only.** A company here is a hand-written note with a brand guide, pricing and
  years of context under it — `Companies/TrueFerret/` is 340-odd sub-notes deep. lull-pm has nothing
  to add to that, and a stub would only be a worse version of the note the user would write. It
  lists them, counts what hangs off them, and opens them in Obsidian.
- **A company note inside another company's folder is still a company.** lull-pm does not demote it
  to a sub-note on the strength of where it sits — the note says what it is.
- `src/lib/models/Goal.ts`, `GoalService.ts`, `GoalManager.svelte.ts`, route `/goals` — the sidebar
  link is live now. Flat notes in `Goals/`, parent = bucket xor company, grouped by status. lull-pm
  creates the `Goals/` folder on first write; the category note, base and template are the user's.
  This is the one type lull-pm meets empty — the vault has `Categories/Goals.md` but no goals yet.
- `NewGoalDialog` puts companies and buckets in **one** select. A single selection means a goal
  cannot come out of the dialog connected to two things — the rule is enforced by the shape of the
  control, not by a check after the fact.
- `.lull/config.json` `folders` gains `companies` and `buckets`.

## Phase 4 — Project types, driven by Templater ✅

A **type is a template note**. lull-pm scans Templater's `templates_folder` for notes with
`categories: [[Projects]]` and reads two keys:

```yaml
---
categories:
  - '[[Projects]]'
type: Content
statuses: [Idea, Scripting, Filming, Editing, Review, Published]
org:
status: Idea
content channel:
---
```

- `type: Content` is ordinary frontmatter and is copied into every project made from the template.
  That is the tag lull-pm reads back to know which pipeline a project is on.
- `statuses:` is the pipeline, and is **stripped from the created note** via the existing
  `removeFrontmatterKey` — a surgical line removal — so each project carries its type, not a
  duplicated list.
- Templates are written and edited in Obsidian. Templater expands them normally when a note is
  created there instead of in lull-pm.

**Choosing a template on create** follows Templater's own rules: longest-matching `folder_templates`
prefix for the destination folder, honouring `enable_folder_templates`, falling back to
`Templates/Project Template.md`. The New Project dialog can also pick a type outright, which selects
both the template and the folder that maps to it.

**Cross-type views.** "Filming" means nothing to the Today page, so every status gets a phase —
`idea`, `active`, `done`. Derived from **position** rather than declared: a pipeline is ordered, so
the first status is where things start and the last is where they end. One optional `terminal:` key
overrides the ending when a type has more than one way to finish. That needs no extra config for the
common case and no new YAML shapes.

**A status the note already holds is always offered**, even when the pipeline does not list it. The
note is the authority on what it says; dropping its current status from the picker would make the UI
quietly lie about where the project is.

`PROJECT_STATUSES` stops being a constant and becomes `statusesFor(status, type)`. The real vault
only uses Idea / In Progress / Done today, so that is the default type's pipeline.

A `/settings` page (the sidebar links to it; no route exists yet) lists discovered types, shows each
pipeline, and opens the template note in Obsidian to edit it. lull-pm reads type definitions;
Templater and Obsidian own them.

## Phase 4.5 — The overview ✅

`/overview` — the place to see what lull-pm could not place. Five kinds of finding:

| Kind                      |                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `unparseable-frontmatter` | **Blocking.** lull-pm shows the note but refuses every write to it.                                                 |
| `two-kinds`               | Connected to a bucket _and_ a company/project.                                                                      |
| `too-many-parents`        | Connected to two of the same kind.                                                                                  |
| `uncategorised`           | Sits directly in a typed folder, or is a folder's `!` main note, but claims no category — so lull-pm cannot see it. |
| `legacy-bucket-flag`      | Still carries `bucket: true`.                                                                                       |

Nothing on the page writes. Every finding names the note, says what lull-pm sees, suggests what the
user might do, and opens in Obsidian on click.

The filter is deliberately narrow. The first cut flagged 121 of 1386 notes — `_Inbox Notes/`, where
having no category is the _point_ of the folder, and every sub-note under a project folder, which is
supposed to carry none. Excluding the inbox and resolving sub-notes through Phase 0's main-note
logic brought it to **7 genuine findings**, all of them main notes that are plainly entities and
plainly invisible (`!lull.app.md`, `!lull-Extension.md`, `lull-pm.md`).

`src/lib/vault/audit.ts`, `src/lib/managers/AuditManager.svelte.ts`,
`src/routes/overview/+page.svelte`. The sample vault carries three deliberately non-conforming notes
so `npm run dev` shows the populated state, not only the empty one.

## Phase 5 — UI ✅

`ParentPicker.svelte` — one searchable select, offering only the kinds the note's type allows, with
each option labelled by kind so a bucket and a company of the same name stay distinct. The rule is
enforced by the _shape_ of the control: one selection means two connections cannot be expressed.

It replaces the separate Bucket and Projects fields in `TaskDetailSheet` and `InboxRow` — two
controls that could disagree became one that cannot — and adds a Connected-to field to
`ProjectDetailSheet`. A note that already breaks the rule shows an inline note saying that picking
one here will fix it.

`ProjectDetailSheet` gains a type badge and a type-aware status select. `ProjectCard` shows type and
parent. `NewProjectDialog` gained a type picker that swaps the status chips and reports the exact
folder and template it will use.

## Phase 6 — Truth-up ✅

The README's data-model table was wrong the moment Phase 0 landed — it documented `org` as Bucket,
which was never true of the data. Rewritten: how a note's type is decided and why it is not the
folder, the never-both rule, the project-type mechanism, a five-row data-model table, and the
no-migration rule stated up front. `real-vault.spec.ts` asserts the XOR rule across every note in
the real vault, read-only.

---

## Order and risk

Phases 0 and 1 are load-bearing and mostly invisible; 2–6 are additive. Phase 0 changes how every
note is discovered, so it ships behind the real-vault test before anything is built on it.

The riskiest single change is `getScalar` and list-valued `status`, because it is the first time a
write has to preserve a YAML shape rather than a line. Everything else is new code beside existing
code.

Nothing in this plan moves or renames a file in the vault.
