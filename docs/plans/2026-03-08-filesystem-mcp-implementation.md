# Filesystem MCP Implementation Plan

**Date:** 2026-03-08

## Scope

Implement the official filesystem MCP server in `netmanager` by editing `netmanager/.mcp.json` only.

## Steps

1. Add a `filesystem` entry under `mcpServers` in `netmanager/.mcp.json`.
2. Use `npx -y @modelcontextprotocol/server-filesystem` as the command.
3. Pass `/Users/rohadimraja/Documents/projek/netmanager` as the only allowed directory.
4. Validate that the JSON still parses correctly.
5. Confirm the diff is limited to the intended config and planning docs.

## Verification

- Parse `netmanager/.mcp.json` with Node.js JSON parsing.
- Inspect the resulting `mcpServers.filesystem` entry.
- Review git diff to confirm the change stays narrowly scoped.

## Rollback

Remove the `filesystem` entry from `netmanager/.mcp.json` if the server should not be available in this project.
