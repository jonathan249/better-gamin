# AGENTS.md

## Purpose
Guidelines for coding agents working in this repository.

## Security Rules (Required)
- **Never read `.env` files**.
- Never print or expose credentials, tokens, or personal account data.
- Do not add secrets to logs, source files, commits, or output.

## Working Rules
- Use the project structure as-is (`backend/`, `frontend/`, cache files).
- Prefer small, targeted edits over large rewrites.
- Keep features simple and verifiable from the terminal.
- Validate changes by running relevant commands after edits.

## Data Handling
- Treat Garmin data as sensitive personal health data.
- Use cached data where possible instead of unnecessary API fetches.
- If adding new data flows, document what is stored and where.

## UI/Code Expectations
- Keep TUI output readable in standard terminal widths.
- Avoid overflowing layouts; prefer responsive/fixed-safe dimensions.
- Add clear keyboard hints for interactive features.

## Agent Capability
- **Use the skills provided** by the harness/tools when available.
