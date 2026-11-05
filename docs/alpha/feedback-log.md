# Alpha feedback log

Severity: P0 security/data loss/login broken · P1 logging failure or blocking confusion · P2 friction · P3 polish.
Status: new → understood → planned → fixed (with commit) → verified by tester.

| # | Date | Tester | What they said / saw | Our read | Sev | Status |
|---|---|---|---|---|---|---|
| 1 | 2026-11-04 | Tester (signup) | "email rate limit exceeded" on Sign Up, shown in teal | Supabase built-in email sender caps a few emails/hour per project. Not an app bug, but the message was raw and styled as success | P1 | **Fixed**: confirmation turned off for alpha (owner); friendly red errors + double-tap guard live in b846167. Before the 20-30 beta: custom SMTP, then confirmation back on |
| 2 | 2026-11-04 | Tester | "The problem is I don't know what the workout look like??" Clarified: she wanted to see how to do each exercise in her plan, ideally a video | Exercise names alone don't teach a beginner the movement. Steps already existed in the library but weren't shown on the workout or plan screens | P1 for beginners (blocks the first workout) | Built on `exercise-howto` (964bf7b): "How to do it" on every exercise with a video link and written steps. Awaiting "merge" |
| 3 | 2026-11-05 | Owner | After onboarding, someone may realize 3 days fits better than the 4 they picked. Can they change days and have the plan readjust? | Not really today. The onboarding page (/start) can be revisited only by typing the URL; Plan has "Start from a template" but it ignores their goal, time and comfort answers. Nothing says "change my days" | P2 (workaround exists but nobody would find it) | Proposed: "Change training days" on Plan and Settings, re-runs onboarding with answers prefilled, creates the new plan and switches to it; old plan and history kept |
