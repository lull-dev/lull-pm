# lull-pm

lull's project-management surface — Tasks, Projects and Buckets — backed by an Obsidian vault
instead of a database.

Tasks are notes in `Tasks/`, projects are notes in `Projects/`. A "Bucket" (the life-area grouping —
work vs. personal, one org vs. another) is not a new note type: it's the `org:` property every real
task and project note in the vault already carries, and every `.base` file already filters on. There
is no database, no sync engine and no account — the vault is the data.

Nothing here is invented: the note schema comes straight from the vault's own `Templates/Task
Template.md`, `Templates/Project Template.md` and their `.base` query files, so lull-pm reads and
writes notes the vault already understands.

## The rule everything else follows

The vault is real, irreplaceable data. So lull-pm never serialises a note from an in-memory model.
Every write is a surgical edit to the bytes that changed:

- a status change rewrites one value on one line
- a checkbox toggle rewrites one character between `[` and `]`
- a property edit replaces only the lines that property owns

Everything else in the file comes through byte-for-byte. See `src/lib/vault/frontmatter.ts` and
`checkbox.ts` for exactly how.

## Check it against your own vault first

`src/lib/vault/*.spec.ts` proves the above on fixtures. This proves it on _your_ notes, all of them,
without writing anything:

```bash
LULL_VAULT=~/TrueFerret-Vault npm test
```

It opens every markdown file and checks that splitting and reassembling is lossless, and that
rewriting each property at its current value changes nothing. It also lists any notes whose
frontmatter does not parse, which lull-pm will refuse to write.

## Status

- [x] Vault adapter — Tauri filesystem, in-memory for tests, safe read/modify/write
- [x] Frontmatter, wikilinks, checkboxes, sections
- [x] Tasks — `Tasks/` notes, drag-and-drop status board
- [x] Projects — `Projects/` notes, per-project task list
- [x] Buckets — `org:` as a first-class filter across Tasks and Projects
- [x] Inbox — the Inbox status, surfaced as its own page for triage
- [ ] Goals — `Goals/` folder

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

## Data model

| Note type | Folder      | Key frontmatter                                              |
| --------- | ----------- | ------------------------------------------------------------ |
| Task      | `Tasks/`    | `status`, `priority`, `org`, `projects`, `due`, `do`, `done` |
| Project   | `Projects/` | `org`, `clients`, `status`, `start`, `end`                   |

The `org` property is what the UI calls a Bucket — no separate note type, just a filter over whatever
values already show up there. `due` and `do` are the only frontmatter this session added beyond what
the real vault's `Templates/Task Template.md`, `Templates/Project Template.md` and their `.base` query
files already expected.

## Development

```bash
npm install
npm test          # the safety net — run this before trusting any write
npm run check
npm run dev        # browser, against an in-memory sample vault
npm run tauri dev  # desktop, against a real vault folder you pick
```

Point the desktop build at a **copy** of your vault until you trust it. There is a copy at
`../lull-vault-dev`.
