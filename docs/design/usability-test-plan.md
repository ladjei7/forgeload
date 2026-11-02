# Usability test plan

Goal: find out whether people choose this over their current tracker, and where the logger fails. Not a popularity vote.

## Who
5 lifters per round, 2 rounds. Mix: 2 beginners (under 6 months), 2 intermediate who currently use Hevy or Strong, 1 experienced who uses a spreadsheet or notes. Include at least 2 who lift with one hand free (phone in a hand, chalk, etc).

## Setup
Their own phone, open `/design-preview` in the browser (preview URL). Real gym if possible, otherwise a table with a weight in hand. Screen recording on, think aloud. Open Proto tools only to switch scenarios.

## Tasks (success = done without help; record time, taps, errors)
1. Set up a plan from scratch (onboarding to Create plan). Observe: do they understand the generated plan? Do they open Swap?
2. Start today's workout and log all 3 sets of the first exercise at target. Metric: taps, time, hesitations.
3. Log a set that missed the target (one rep short). Metric: taps, did they find the stepper or the field?
4. Say out loud what the target is and why. Then open the explanation. Metric: could they restate the rule?
5. Change today's target (feeling weak). Metric: found it? ("Why this target" then "Change target")
6. Swap an exercise because the machine is taken. Then try after logging a set.
7. Rest timer: add 15 s, skip.
8. Network fails on a save (Proto: Next save fails). Metric: did they notice, retry, trust it?
9. Go offline, log two sets, come back online.
10. Close the app mid-workout (Proto: Interrupted workout), reopen, resume. One set failed: do they understand?
11. Finish with 12 sets unlogged. Do they understand what "skipped" does to next targets?
12. Plan: make Lower A next, change sets on Row, remove an exercise and undo.
13. Add a custom exercise and use it in a workout.
14. Compare: do task 2 and 3 in List and in Focus (alternate order). Ask which they would use in the gym and why.

## Measures
- Task success, time, taps (counter in Proto tools), errors, backtracks.
- Per set: taps and seconds. Target: median 1 tap at target, under 6 s.
- Comprehension: can they state the next target and its reason in their own words (task 4)?
- Trust: "Is your set saved?" asked after tasks 8 to 10.
- SUS-style 5 questions plus one open question: "What would make you switch from your current app?" and "What would make you leave?"

## Pass / fail signals
- Pass: 4 of 5 complete tasks 2, 3, 4, 8 and 12 unaided; median set under 6 s; at least 3 of 5 prefer it to their current app for logging.
- Fail: anyone loses a set without noticing; 2 or more cannot find Change target or Swap; Focus and List preference splits by experience (then default by level).

## What we change based on results
Log wrong weight or double logs: add undo toast and sanity warning. Change target not found: surface it next to the target. Focus beats List: make it default for new users. Onboarding taps too high: auto-advance.
