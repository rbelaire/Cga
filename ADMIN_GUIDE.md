# CGA Admin Guide (Practical, Non-Technical)

This guide is for day-to-day CGA admins who run tournament operations.

## Main admin areas
The admin experience is organized around the core tournament tasks:
- **Operations / setup** for tournament context and event prep
- **Payments** to track who has paid
- **Pairings** to build and post groups
- **Scores** to enter results by flight
- **Users / supporting admin data** (as needed)
- **Snapshots / Restore** for recovery and rollback support

Use the workflow tracker and quick actions to move through the sequence efficiently.

## Typical tournament workflow
A practical flow most admins can follow:
1. **Set up the tournament context** and confirm you’re on the correct event.
2. **Record payments** for participating members.
3. **Enter players into flights** (tournament roster).
4. **Generate/post pairings** so members can view groups.
5. **Enter scores** as they become available.
6. **Save Draft** while work is in progress.
7. **Publish Results** once scores are final and verified.

## Save Draft vs Publish Results
### Save Draft
Use this during active work.
- Saves your score-entry progress for later.
- Does **not** make official standings/POY changes live.
- Best for partial entry, corrections, and mid-process updates.

### Publish Results
Use this only when the event is final.
- Runs the official results calculation.
- Updates live tournament results, standings, and POY tables.
- Intended as the authoritative member-facing release step.

## What happens when results are published
When you confirm publish:
- the selected tournament results are written as completed,
- season standings are recalculated and updated,
- season POY tables are recalculated and updated,
- public/member views reflect those updates right away.

## Safeguards, snapshots, and restore
### Safeguards
The admin flow includes checks to help prevent bad publishes:
- required data validation,
- consistency checks on tournament/member references,
- clear error messages when something must be fixed first.

### Snapshots
Before major writes, the system captures snapshots of important data.
These snapshots provide a recovery point if something unexpected happens.

### Restore
From the **Snapshots / Restore** area, admins can:
- review recent snapshot entries,
- choose a snapshot,
- confirm restore to replace current live data for that area.

Restore actions are logged for traceability.

## Best practices
- Confirm the correct tournament before entering/editing data.
- Save draft frequently during score entry.
- Use a quick cross-check (names, PTM/score completeness, obvious outliers) before publish.
- Treat publish as the final official step, not a routine save.
- If a mistake is discovered, use snapshots/restore promptly and document what was corrected.

## Quick reference
- **Working in progress?** → **Save Draft**
- **Final and verified?** → **Publish Results**
- **Need to undo a major issue?** → **Snapshots / Restore**
- **Not sure what’s next?** → Follow the workflow tracker and quick action prompts
