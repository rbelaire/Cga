# CGA Admin Guide (Practical, Non-Technical)

This guide is for day-to-day CGA admins who run tournament operations.

## Main admin areas
The admin experience is organized around core tournament tasks:
- **Operations / setup** for tournament context and event prep
- **Payments** to track who has paid
- **Pairings** to build and publish groups
- **Scores** to enter results by flight
- **Users / supporting admin data** (as needed)
- **Snapshots / Restore** for recovery and rollback support

Use the workflow tracker and quick actions to move through the sequence efficiently.

## Typical tournament workflow
A practical flow most admins can follow:
1. **Set the tournament context** and confirm the correct event.
2. **Record payments** for participating members.
3. **Enter players into flights** (tournament roster).
4. **Generate/post pairings** so members can view groups.
5. **Enter scores** as they become available.
6. **Save Draft** while work is still in progress.
7. **Publish Results** once scores are final and verified.

## Save Draft vs Publish Results
### Save Draft
Use this during active work.
- Saves in-progress score entry for later.
- Does **not** update official standings/POY tables.
- Best for partial entry, corrections, and mid-process updates.

### Publish Results
Use this only when the event is final.
- Runs official result calculations.
- Updates live tournament results, standings, and POY tables.
- Serves as the authoritative member-facing release step.

## What happens when results are published
When you confirm publish:
- the selected tournament result is marked complete and written live,
- season standings are recalculated and updated,
- season POY tables are recalculated and updated,
- public/member views update immediately.

## Safeguards, snapshots, and restore
### Safeguards
The admin flow includes checks to help prevent bad publishes:
- required data validation,
- consistency checks on tournament/member references,
- clear error messaging when prerequisites are missing.

### Snapshots
Before major writes, the system captures snapshots of critical data. These snapshots provide recovery points for accidental edits or publish mistakes.

### Restore
From **Snapshots / Restore**, admins can:
- review recent snapshot entries,
- choose a snapshot target,
- confirm restore to replace current live data for that area.

Restore actions are logged for traceability.

## Best practices
- Confirm the correct tournament before entering/editing data.
- Save draft frequently during score entry.
- Cross-check names, score/PTM completeness, and obvious outliers before publish.
- Treat publish as the final official step, not a routine save.
- If a mistake is discovered, restore quickly and note what was corrected.

## Quick reference
- **Working in progress?** → **Save Draft**
- **Final and verified?** → **Publish Results**
- **Need to undo a major issue?** → **Snapshots / Restore**
- **Not sure what’s next?** → Follow workflow tracker and quick action prompts
