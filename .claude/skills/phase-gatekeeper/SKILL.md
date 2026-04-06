---
name: phase-gatekeeper
description: Validates completed phase and asks user for confirmation before proceeding to next phase. Ensures nothing is broken and baseline is functional.
---

# Phase Gatekeeper Skill

**Purpose**: Before moving to the next phase in a multi-phase project, this skill performs sanity checks and asks the user for confirmation that the current phase is complete and functional.

---

## When to Use

- At the **end of each phase** before starting the next phase
- After implementing a major architectural change
- When you need user validation before proceeding
- To ensure no regressions were introduced

---

## How to Invoke

```
/gatekeeper
```

or

```
use phase-gatekeeper skill
```

---

## What It Does

1. **Analyzes current phase completion**:
   - Checks if all planned deliverables exist
   - Verifies file structure is correct
   - Looks for obvious syntax errors or missing dependencies

2. **Runs basic sanity tests** (if available):
   - `npm test` for services with tests
   - `npm run lint` if configured
   - `node --check` for syntax errors

3. **Summarizes what was accomplished**:
   - Files created
   - Tests written
   - Dependencies added

4. **Prompts user for confirmation**:
   - Shows summary
   - Asks: "Proceed to next phase?"
   - Options: Yes / No / Review specific item

---

## Example Interaction

```
You: /gatekeeper

Phase Gatekeeper Report:
────────────────────────
Phase: 02 - Database Layer
Status: All deliverables present

✅ All 6 models created
✅ BaseRepository implemented
✅ Repository tests added (6 services)
✅ Jest configs added (6 services)
✅ Connection utilities added
✅ Migration script prepared

Tests: Not yet run (would take 2-3 min)

Proceed to next phase (User Service)?
[Yes] [No] [Run tests first]
```

---

## Configuration

This skill respects:
- The project's plan files in `.claude/plans/`
- Acceptance criteria defined in each plan
- Existing test commands in `package.json`

---

## Notes

- This is a **checkpoint** skill, not an automatic validator
- It doesn't replace thorough testing, but catches obvious oversights
- User should review the summary and run tests if needed
- If user says "No", they can provide feedback and you should fix issues first
