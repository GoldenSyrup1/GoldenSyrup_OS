# architectures/

One JSON file per architecture drawn in the **Architectures** view, written here by the
local orchestrator (`PUT /architectures`).

These are committed on purpose. The canvas used to persist only to browser `localStorage`,
which meant the diagrams were invisible to Claude Code, to Cowork, and to Claude — and died
with the browser cache. On disk and in the repo they are context: an agent working in this
checkout can just read them, `git diff` shows how a design changed, and `/run` can ship the
graph along with a prompt.

- File name: `<name-slug>--<id>.json`. The slug keeps the folder readable; the id is what
  guarantees uniqueness when two diagrams share a name.
- Written only by the orchestrator — hand-editing is fine, but the next save from the browser
  replaces the whole set (that is how deletes and renames are honoured).
- Without the orchestrator running, the canvas falls back to `localStorage` and nothing lands
  here. The badge in the Architectures view reads **browser only** when that is the case.

Shape (see `Architecture` in `src/types.ts`):

```json
{
  "id": "arch-1721000000000",
  "name": "WEPort",
  "blocks": [{ "id": "block-1-0", "kind": "client", "label": "Web Client", "x": 40, "y": 40 }],
  "links": [{ "id": "link-1-1", "source": "block-1-0", "target": "block-1-1", "label": "REST" }],
  "createdAt": 1721000000000,
  "updatedAt": 1721000000000
}
```
