## Notion Workspace Operating Rules

Rustan's Notion is strictly read-only for the human; agents own all writes and filing.
Before ANY Notion write, fetch the canonical Notion Skill: https://app.notion.com/p/41fad88a64e08175b961d3cb994d1b39 ("Notion Operating Contract").

1. **Two destinations only:** Project status/handoff → `Projects` (`collection://41fad88a-64e0-81bc-99d6-000ba86fb39c`). Any other durable output → `Docs` (`collection://be4c6e51-2801-46b4-9674-c003a68d9f72`).
2. **Never orphan or nest:** Always pass `parent: { type: "data_source_id", ... }`. Never use `creation_mode: "draft"`, never nest child pages under rows, never create root pages or databases.
3. **Complete on create (closed vocabularies):** Set `Name`, `Area` (`Engineering|Career|Life|Games`), `Kind` (`Decision|Design|Guide|Research`), `Summary`, `Archived: "__NO__"` in one call. If `Project` is set, `Area` must be `Engineering`.
4. **Never trash or touch secrets:** Never call `notion-delete-pages` without explicit user approval (retire Docs with `Archived = "__YES__"` + Superseded banner). Never fetch, quote, or move `Passwords` (`3f2ad88a-64e0-8049-9ca0-ce95ef1eab07`).
5. **Post-write gate:** Verify the page's `ancestor-path` is in `Docs` or `Projects` and check `notion-list-private-pages` so zero orphans remain.
