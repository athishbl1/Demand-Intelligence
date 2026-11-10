# Attribution and third-party licenses

This template for the buildbar_ setup at the TTF Hackathon 2026 uses and bundles work by Romuald Członkowski (n8n-mcp and n8n-skills) and Matt Pocock. Thank you!

## n8n-mcp (MCP server)

- Project: https://github.com/czlonkowski/n8n-mcp
- Connected through an HTTP MCP endpoint of the buildbar_ hub (see `.mcp.json`, `.codex/config.toml`, `opencode.json`); the server itself is not part of this repository.

## Bundled n8n skills (vendored)

The following skills under `.claude/skills/` come from the project
[`czlonkowski/n8n-skills`](https://github.com/czlonkowski/n8n-skills) and are under the MIT license:

`n8n-code-javascript`, `n8n-code-python`, `n8n-expression-syntax`,
`n8n-mcp-tools-expert`, `n8n-node-configuration`, `n8n-validation-expert`,
`n8n-workflow-patterns`

**Adapted:** `n8n-expression-syntax`, `n8n-mcp-tools-expert` and `n8n-validation-expert` carry short
added sections about typical n8n traps. `n8n-mcp-tools-expert` (`SKILL.md` and `WORKFLOW_GUIDE.md`)
also carries a note about the tools that are blocked in this setup. All other files are unchanged.

**Updates:** these skills are a snapshot. Pull the current version from
`czlonkowski/n8n-skills` (`skills/*`) when needed.

```
MIT License

Copyright (c) 2025 Romuald Członkowski (https://www.aiadvisors.pl/en)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

## grill-me (skill)

The skill `.claude/skills/grill-me/` is **adapted** from
[mattpocock/skills](https://github.com/mattpocock/skills) (`grilling` and `grill-me`),
MIT license, © Matt Pocock.

## Own skills and code

All other skills (`ttf-challenges`, `idea-to-plan`, `data-catalog`, `publish`, `n8n-testing`,
`n8n-documentation`, `n8n-security-audit`, `frontend-build` and `frontend-scaffold`), the example
under `examples/workflows/`, `frontend-starter/` and the instruction files are under the MIT license
of this repository (see `LICENSE`).

## Deliberately not included

The office skills by Anthropic (`pptx`, `docx`, `xlsx` from
[anthropics/skills](https://github.com/anthropics/skills)) are under a proprietary license.
They are neither copied into this template nor used as a basis for its skills.
