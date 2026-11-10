---
name: n8n-documentation
description: Documents the team's n8n workflows with sticky notes in plain language, so that team members, judges and the challenge partner understand the flow without opening every node. Use after building or validating a workflow, before the pitch, or when the team asks to document, explain or comment a workflow.
---

# Document a workflow with sticky notes

After building or validating a workflow, add **sticky notes** that explain in plain language what the workflow does. This helps the team in the pitch and everyone who opens the workflow later.

## Keep it short

One overview note and at most one note per section. Then move on. Notes go only into the team's own workflows.

## When

- After `n8n_create_workflow` or a larger change (new nodes, new logic).
- Before the pitch, so the workflow tells its own story on screen.
- When the team asks: "document the workflow", "explain it", "add sticky notes".
- **Language:** the language of the team (default: English).

## What to write

1. **Overview note** at the top left: what the workflow does in one or two sentences, when it runs (trigger), what comes out, which sources it uses.
2. **One note per section** (for example "Receive request", "Fetch places", "Ask the model", "Answer the app"), placed above the nodes of that section:
   - what happens here, in everyday words
   - what to watch out for (for example "uses the credential TTF Apify, costs per result")

No code details, no node internals: the why, not the how.

## How to add them (n8n-mcp)

Sticky notes are normal nodes of type `n8n-nodes-base.stickyNote`. Add them with `addNode` operations in `n8n_update_partial_workflow`. They do not change the data flow (no connections needed).

Parameters of a sticky note:

- `content`: Markdown (a `##` heading and a short explanation)
- `width`, `height`: size, for example 320 by 160, big enough for the text
- `color`: a number from 1 to 7, for example 4 for the overview, 5 for input, 3 for processing, 2 for output and warnings
- `position`: `[x, y]`, above the nodes of the section (smaller y), so it does not cover any node

Example operation:

```json
{
  "type": "addNode",
  "node": {
    "name": "Note: Overview",
    "type": "n8n-nodes-base.stickyNote",
    "position": [-200, -160],
    "parameters": {
      "content": "## What this workflow does\nThe app sends a place and a date. The workflow looks up the weather for that day and the sights nearby and answers with a short list.\n\n**Runs when** the app calls the webhook.",
      "height": 180,
      "width": 340,
      "color": 4
    }
  }
}
```

## Steps

1. Read the workflow (`n8n_get_workflow`), group the nodes into sections and note their positions.
2. Place one note slightly above each section and one overview note at the top left.
3. Add all notes in **one** `n8n_update_partial_workflow` call (several `addNode` operations).
4. Validate briefly (`n8n_validate_workflow`): notes must not break anything. If the workflow is active, publish again so the editor and the live version match.

## Don'ts

- No keys, tokens or personal data in the notes.
- Never place notes over nodes; always above or next to them.
- Do not comment every node: one note per section is enough.
