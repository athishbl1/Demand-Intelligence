#!/usr/bin/env node
// PostToolUse hook: logs workflow changes (create, update) made through the buildbar connection.
//
// It stores the tool input (intent, operations) and the start of the tool result in
// backup/workflow-changes/. backup/ is in .gitignore and disappears with the session container
// in Claude Code on the web. Only what is committed under workflows/ is kept for good
// (workflow JSON fetched with n8n_get_workflow).

const fs = require("fs");
const path = require("path");

const PREFIX = "mcp__buildbar__";
const BACKUP_TOOLS = [
  PREFIX + "n8n_create_workflow",
  PREFIX + "n8n_update_partial_workflow",
  PREFIX + "n8n_update_full_workflow"
];

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || "";
    const toolInput = data.tool_input || {};
    // Claude Code passes the result of PostToolUse as tool_response (tool_result only as a fallback).
    const toolResult = data.tool_response || data.tool_result || {};
    const cwd = data.cwd || process.cwd();

    if (!BACKUP_TOOLS.includes(toolName)) {
      process.exit(0);
    }

    const workflowId = String(toolInput.id || "new").replace(/[^A-Za-z0-9_-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const action = toolName.replace(PREFIX, "");

    const backupDir = path.join(cwd, "backup", "workflow-changes");
    fs.mkdirSync(backupDir, { recursive: true });

    const backupFile = path.join(backupDir, `${timestamp}_${action}_${workflowId}.json`);
    const backupData = {
      timestamp: new Date().toISOString(),
      action,
      workflowId,
      intent: toolInput.intent || null,
      toolInput,
      toolResult: typeof toolResult === "string" ? toolResult.slice(0, 2000) : toolResult
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  } catch {
    // A failed backup must never block the work.
  }

  process.exit(0);
});
