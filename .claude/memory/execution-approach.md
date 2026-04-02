---
name: Migration Execution Approach
description: How to proceed through microservices migration plans
type: feedback

## Approach: Implement First, Plan Dynamically

**Rule**: Do not pre-write all service plans (03-17). Instead:
1. Complete current plan (Plan 02 - Database Layer)
2. After implementation, create the **next** plan document based on:
   - What was learned during implementation
   - Actual code structure that emerged
   - Real dependencies discovered
   - Adjustments needed for portfolio showcase
3. Repeat: implement → reflect → plan next

**Why**:
- Plans based on theory may not match implementation reality
- Allows adjusting architecture based on actual monolith code analysis
- Keeps documentation accurate and actionable
- Avoids waste from over-planning features that change

**How to resume**:
- Check PLANS-INDEX.md to see completed plans
- Current stopping point: Plan 01 complete, starting Plan 02
- After Plan 02, user will say "create Plan 03" and I'll write it based on what we learned

**Trigger**: User says "proceed with Plan 02" or "create next plan"

---

**Co-Authored-By**: Claude Opus 4.6
**Created**: 2026-04-02
**Last Updated**: 2026-04-02
