# CGA Admin Guide (Practical, Non-Technical)

This guide is for day-to-day CGA admins who run tournament operations.

## Main admin areas
The admin experience is organized around core tournament tasks:
- **Dashboard** — workflow tracker and lifecycle overview for the active tournament
- **Flight Management** — roster and flight assignments, credit balances per player
- **Payments** — track who has paid per tournament
- **Pairings** — build and publish player groups
- **Scores / Results** — enter scores by flight, publish final results
- **Credits** — adjust member credit balances
- **Exports** — generate PDFs and spreadsheets from live data
- **Snapshots / Restore** — review and restore previous data states
- **Changelog** — audit log of key admin actions
- **Users / Member Management** — manage member list and admin access
- **Beginning PTM** — snapshot PTM at the start of the season for Most Improved tracking

Use the workflow tracker and quick actions on the Dashboard to move through the sequence efficiently.

## Typical tournament workflow
A practical flow most admins can follow:
1. **Confirm the active tournament** from the tournament selector.
2. **Record payments** for participating members.
3. **Assign players to flights** in Flight Management.
4. **Generate/post pairings** so members can view groups.
5. **Enter scores** by flight once the event is complete.
6. **Save Draft** while work is still in progress.
7. **Publish Results** once scores are final and verified.

## Save Draft vs Publish Results
### Save Draft
Use this during active work.
- Saves in-progress score entry for later.
- Does **not** update official standings or POY tables.
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

## Most Improved tracking — Beginning PTM
The **Most Improved / Least Improved** page compares each player's current PTM against their PTM at the start of the season.

To set the season baseline:
1. Go to **Beginning PTM** in the admin nav.
2. Confirm the action — this snapshots the current PTM list as the season-start reference.
3. Save once at the beginning of the season. Overwriting mid-season will reset all comparisons.

Qualification for the Most Improved page requires a player to have 7 or more total rounds on record and at least 3 rounds in the current calendar year.

## Exports
The **Exports** panel generates downloadable files from live data:
- Pairings PDF
- Tournament results PDF
- PTM list PDF
- Credit balances PDF
- Payments spreadsheet (XLSX)
- Tournament info summary

All exports reflect the data as it stands at the moment of generation.

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
- Confirm the correct tournament before entering or editing data.
- Save draft frequently during score entry.
- Cross-check names, score/PTM completeness, and obvious outliers before publish.
- Treat publish as the final official step, not a routine save.
- If a mistake is discovered after publish, restore quickly and note what was corrected in the changelog.
- Snapshot the Beginning PTM once at the very start of the season and do not overwrite it mid-season.

## Quick reference
- **Working in progress?** → **Save Draft**
- **Final and verified?** → **Publish Results**
- **Need to undo a major issue?** → **Snapshots / Restore**
- **Not sure what's next?** → Follow workflow tracker and quick action prompts on the Dashboard
