# lull-pm

lull's project-management surface — Tasks, Projects and Buckets — backed by an Obsidian vault
instead of a database.

Tasks are notes in `Tasks/`, projects are notes in `Projects/`. A "Bucket" (the life-area grouping —
work vs. personal, one org vs. another) is not a new note type: it's the `org:` property every real
task and project note in the vault already carries, and every `.base` file already filters on. There
is no database, no sync engine and no account — the vault is the data.

This is the sibling of [lull-obsidian-app](../lull-obsidian-app), which does the same thing for
Habits. lull-pm forked its vault-access layer (`src/lib/vault/`) at the start and has diverged from
there — the two apps do not share code going forward, only the markdown conventions of the vault
itself.

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

Working: the vault access layer and the markdown core (forked from lull-obsidian-app).

- [x] Vault adapter — Tauri filesystem, in-memory for tests, safe read/modify/write
- [x] Frontmatter, wikilinks, checkboxes, sections
- [ ] Tasks — `Tasks/` notes, status board
- [ ] Projects — `Projects/` notes, per-project task list
- [ ] Buckets — `org:` as a first-class filter across Tasks and Projects
- [ ] Inbox — `_Inbox Notes/`, promote-to-task
- [ ] Goals — `Goals/` folder

## Data model

| Note type | Folder      | Key frontmatter                                        |
| --------- | ----------- | ------------------------------------------------------ |
| Task      | `Tasks/`    | `status`, `priority`, `org`, `projects`, `due`, `done` |
| Project   | `Projects/` | `org`, `clients`, `status`, `start`, `end`             |

Both schemas are taken directly from the real vault's `Templates/Task Template.md`,
`Templates/Project Template.md` and their `.base` query files — not invented here.

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
