@team.md
@AGENTS.md

# Notes for Claude Code

`AGENTS.md` above holds all rules for this repository. Codex and OpenCode read the same file, so every tool in the team follows the same rules. A few points apply to Claude Code only:

- **Skills** in `.claude/skills/` load with the Skill tool. Load the matching skill before you start a task it covers (for example `ttf-challenges` at the first contact, `idea-to-plan` before writing `PLAN.md`, `publish` before publishing).
- **Permissions:** `.claude/settings.json` allows the `buildbar` tools (n8n tools, `team_info`, `publish_app`, `publish_status`) and the usual git and npm commands, and blocks force pushes and the tools the connection does not offer. Ask before anything else that changes things outside this repository.
- **Shell:** run commands from the repository root without `cd ... &&` in front (a compound command with `cd` triggers an extra permission prompt). Use `npm --prefix frontend-starter ...` and plain `git ...`. Create files directly with the Write tool; `mkdir` with square brackets in the path, for example `app/[id]`, is refused.
- **Claude Code in the browser** needs the cloud environment's network access set to "Full", otherwise the `buildbar` tools are missing (see "Connection problems" in `AGENTS.md`). The session also pushes its own branch `claude/...`; that is harmless, but only `main` is built, so always push to `main` as described.
- **Locally** (desktop app, VS Code, VSCodium, terminal) Claude Code reads `.mcp.json` once the folder is trusted. In VS Code or VSCodium, reload the window ("Developer: Reload Window") after the clone, otherwise the extension often keeps its old server list. If `buildbar` still does not show up in `/mcp`, the one-time setup is `claude mcp add --transport http buildbar <url from .mcp.json>` (or "Add server" in the `/mcp` dialog). For Codex the matching one-time command is `codex mcp add buildbar --url <url from .codex/config.toml>`.
- **Python:** on Windows use `python`, not `python3`.
