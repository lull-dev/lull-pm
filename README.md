# lull-pm

lull's project-management surface — Tasks, Projects, Buckets, Companies and Goals — backed by an
Obsidian vault instead of a database.

There is no database, no sync engine and no account — the vault is the data.

Nothing here is invented: the note schema comes straight from the vault's own templates and `.base`
query files, so lull-pm reads and writes notes the vault already understands.

## How a note's type is decided

By its `categories:` property, not by the folder it sits in. That is what the vault itself does —
`Templates/Bases/Projects.base` opens with `categories.contains(link("Projects"))`, and Tasks.base
and Companies.base do the same.

It matters more than it sounds. In a real vault, `Companies/lull-Software/lull.app/!lull.app.md` is
a project, `Schneider Electric/Schneider Electric.md` is a company, and neither lives in the folder
its type is named after. A folder scan finds six companies where there are eight, and silently
loses the two that `Projects.base` filters on.

Folders are still where _new_ notes go. They are just not what a note **is**.

## The rule everything else follows

The vault is real, irreplaceable data. So lull-pm never serialises a note from an in-memory model.
Every write is a surgical edit to the bytes that changed:

- a status change rewrites one value on one line
- a checkbox toggle rewrites one character between `[` and `]`
- a property edit replaces only the lines that property owns

Everything else in the file comes through byte-for-byte. See `src/lib/vault/frontmatter.ts` and
`checkbox.ts` for exactly how.

And the rule above that one: **lull-pm does not change files you made.** There is no migration, no
sweep, no tidying the vault to match lull-pm's shape. It writes when you ask it to — a status
change, a new task, a parent picked from a dropdown — on the note you were looking at. Notes it
cannot make sense of are _reported_, never repaired: the Overview page lists them, says why, and
opens each one in Obsidian.

## Check it against your own vault first

`src/lib/vault/*.spec.ts` proves the above on fixtures. This proves it on _your_ notes, all of them,
without writing anything:

```bash
LULL_VAULT=~/TrueFerret-Vault npm test
```

It opens every markdown file and checks that splitting and reassembling is lossless, and that
rewriting each property at its current value changes nothing. It also lists any notes whose
frontmatter does not parse, which lull-pm will refuse to write.

## What connects to what

    A Project connects to a Bucket or a Company.
    A Task    connects to a Bucket or a Project.
    A Goal    connects to a Bucket or a Company.

Never both, never two. On disk it stays two frontmatter keys, because your `.base` files already
filter on them — `org.contains(link("Ferret Media"))` has to keep working. Setting a connection
writes one key and clears the other in the _same_ edit, so a note is never on disk in a state the
rule forbids. A note that already breaks it is shown as the more specific connection and flagged on
the Overview page; lull-pm does not pick a winner and write it back.

## Status

- [x] Vault adapter — Tauri filesystem, in-memory for tests, safe read/modify/write
- [x] Frontmatter, wikilinks, checkboxes, sections
- [x] Tasks — drag-and-drop status board
- [x] Projects — per-project task list, per-type status pipelines
- [x] Buckets — notes in `Categories/Buckets/`
- [x] Companies — read-only; found by category, wherever they live
- [x] Goals — `Goals/` notes, grouped by status
- [x] Inbox — the Inbox status, surfaced as its own page for triage
- [x] Overview — everything lull-pm could not place, reported and never repaired

## Task status

A task moves through five states: **Inbox** (just captured — no `due` and no `do` date yet),
**Whenever** (triaged, deliberately dateless), **Unstarted** (has a plan but hasn't begun), **In
Progress**, and **Done**. Inbox is the default for a new task, precisely because it starts without
either date — triaging it means giving it a date and moving it to Unstarted, or deciding it doesn't
need one and sending it to Whenever.

`due` is the deadline; `do` is a separate property for the date you actually plan to work it. Neither
implies the other.

## Mobile

lull-pm reads and writes real files on disk, which a phone browser has no way to reach — there is no
filesystem picker to fall back to the way Tauri's dialog is on desktop. Rather than fake it, the
mobile web view skips straight to pointing you at the notes themselves: open the vault in the
Obsidian app, or browse to the folder in your phone's Files app. Every task and project here is just
a markdown file, so nothing lull-pm does is unavailable there.

## Project types

A content project goes Idea → Scripting → Filming → Editing → Review → Published. A development
project goes Idea → In Progress → Done. Both are projects; neither should be forced into the other's
statuses.

**A project type is a template note**, because Templater already decides which template a new note
in a given folder gets. That folder-to-template mapping is a project-type system in everything but
name, so lull-pm reads it rather than keeping a second list that would drift from the one you
actually edit:

```yaml
---
categories:
  - '[[Projects]]'
type: Content
statuses: [Idea, Scripting, Filming, Editing, Review, Published]
status: Idea
---
```

`type:` is ordinary frontmatter and is copied into every project made from the template — that is
what lull-pm reads back to know which pipeline a project is on. `statuses:` is _stripped_ from the
created note, so each project carries its type rather than a duplicate of the list.

Add a type by writing a template. Change a pipeline by editing one. lull-pm never writes a template;
Settings lists what it found and opens each one in Obsidian.

## Data model

| Note type | Category        | Default folder        | Key frontmatter                                                    |
| --------- | --------------- | --------------------- | ------------------------------------------------------------------ |
| Task      | `[[Tasks]]`     | `Tasks/`              | `status`, `priority`, `projects` xor `bucket`, `due`, `do`, `done` |
| Project   | `[[Projects]]`  | `Projects/`           | `status`, `type`, `org` xor `bucket`                               |
| Company   | `[[Companies]]` | `Companies/`          | read-only                                                          |
| Goal      | `[[Goals]]`     | `Goals/`              | `status`, `org` xor `bucket`                                       |
| Bucket    | `[[Buckets]]`   | `Categories/Buckets/` | `created`                                                          |

`org:` is the **company**, which is what it has always held in the vault — `[[Schneider Electric]]`,
`[[Ferret Media]]`, `[[Student Events]]`. Earlier versions of this README called it a Bucket; that
was never true of the data. A task's `org:` is read and displayed but never rewritten: a task's
company follows from its project, and that property is maintained by hand.

lull-pm creates note _folders_ when it writes into them. It does not create category notes,
`.base` files, or templates — those are yours.

## Development

```bash
npm install
npm test           # the safety net — run this before trusting any write
npm run check
npm run dev         # browser, against an in-memory sample vault
npm run tauri:dev   # desktop, against a real vault folder you pick
npm run tauri:build # a real installable build (.deb/.AppImage/.dmg/.exe, per platform)
```

The first `tauri:dev` compiles the Rust side from scratch and takes a few minutes; every run after
that is fast, since cargo caches the build.

Point the desktop build at a **copy** of your vault until you trust it. There is a copy at
`../lull/lull-vault-dev`.
