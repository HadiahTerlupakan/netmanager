# Filesystem MCP Design

**Date:** 2026-03-08

**Problem**

`netmanager` already uses MCP configuration, but it does not expose a local filesystem server. That prevents MCP clients from using the official filesystem server against the project workspace.

**Goal**

Add the official MCP filesystem server to `netmanager` with the smallest practical access scope for local development.

## Recommended Design

Add a new `filesystem` server entry to `netmanager/.mcp.json` using the official package:

```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/Users/rohadimraja/Documents/projek/netmanager"
  ]
}
```

The allowed directory is limited to the `netmanager` project root.

## Why This Approach

- It follows the official MCP filesystem server README.
- It matches the local MCP config style already used in `netmanager/.mcp.json`.
- It keeps filesystem access narrow instead of exposing all of `/Users/rohadimraja/Documents`.
- It avoids adding Docker or a second config system for a simple local setup.

## Security Considerations

- The allowed directory defines the full filesystem surface available to this MCP server.
- Restricting access to `/Users/rohadimraja/Documents/projek/netmanager` reduces accidental access outside the project.
- If broader access is needed later, widen the path intentionally in a separate change.

## Non-Goals

- No Docker-based MCP setup
- No read-only filesystem variant
- No cross-project filesystem scope
- No changes to `netmanager/opencode.json`
