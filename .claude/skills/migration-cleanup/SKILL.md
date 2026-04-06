---
name: migration-cleanup
description: Removes old code that has been migrated to new architecture. Identifies obsolete files/directories from monolith or previous phases and removes them safely.
---

# Migration Cleanup Skill

**Purpose**: After completing a migration phase, identify and remove old code that has been replaced by the new architecture. Prevents code duplication and confusion.

---

## When to Use

- **After** a phase is complete and validated
- Before starting the next phase (clean slate)
- When you know specific old files to remove
- To avoid leaving duplicate implementations

---

## How to Invoke

```
/cleanup
```

or

```
use migration-cleanup skill
```

The skill will:
1. Ask what to remove (provide a list if known)
2. Show what will be deleted
3. Ask for confirmation
4. Move to trash or delete permanently (configurable)

---

## Modes

### 1. **Specific Removal**
You specify exact files/directories:
```
User: /cleanup remove: server/routers/user.js server/models/User.js
```

### 2. **Pattern-Based**
Remove all files matching a pattern:
```
User: /cleanup pattern: "server/routers/*.js"
```

### 3. **Phase-Based**
Remove old code from previous phase:
```
User: /cleanup phase: "01-infrastructure"  # Removes stuff from Plan 01 that got replaced in Plan 02
```

---

## Safety Features

- **Dry-run by default**: Shows what would be deleted without actually deleting
- **Git check**: Warns if files are tracked in git
- **Backup option**: Can move to `.trash/` instead of deleting
- **Requirement**: Must have at least 1 file to show before confirming

---

## Example Interaction

```
You: /cleanup phase: "02-database-layer"
Files to remove (from old implementation):
  - server/models/User.js (monolith)
  - server/models/Package.js
  - server/models/Order.js
  - server/repositories/ (old structure)
  - server/utils/database.js

These files are tracked in git. Proceed with deletion?
[Yes, delete permanently] [Move to .trash/] [Cancel]
```

---

## Configuration

**Default behavior**:
- Dry-run first (show only)
- Ask for confirmation before any deletion
- Prefer moving to `.trash/` over permanent delete
- Check git status and warn about tracked files

**User preferences** (can be set in `.claude/settings.local.json`):
```json
{
  "migration-cleanup": {
    "defaultAction": "trash",  // "trash" or "delete"
    "skipGitCheck": false,
    "autoConfirm": false
  }
}
```

---

## Notes

- **Never** delete without user confirmation
- If user says "No", ask what to do instead
- This skill helps maintain a clean, modern codebase
- Old code should be removed **only after** new code is confirmed working
