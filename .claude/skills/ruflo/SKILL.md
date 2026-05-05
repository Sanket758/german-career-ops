---
name: ruflo
description: Enterprise AI agent orchestration platform -- swarms, memory, self-learning
user_invocable: true
args: cmd
argument-hint: "[init | swarm | memory | agent | status | doctor]"
---

# Ruflo -- Agent Orchestration

## Overview
Ruflo (Claude-Flow) provides a "nervous system" for AI agents, allowing them to self-organize into swarms and learn from past tasks. It is integrated as an MCP server.

## Commands

| Input | Description |
|-------|-------------|
| `init` | Initialize Ruflo in the current project |
| `swarm` | Multi-agent coordination and consensus |
| `memory` | High-performance vector memory and semantic search |
| `agent` | Spawn and manage specialized agents |
| `status` | Check system and swarm status |
| `doctor` | Run diagnostics and health checks |

## How to use
Ruflo tools are available via MCP. When the user asks for orchestration, swarm collaboration, or persistent memory beyond the current session, use the tools provided by the `ruflo` MCP server.

### Example Tasks:
- "Initialize a hierarchical swarm with 5 agents for codebase refactoring"
- "Search ruflo memory for previous authentication patterns"
- "Spawn a security agent to scan for CVEs"
