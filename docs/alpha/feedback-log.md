# Alpha feedback log

Severity: P0 security/data loss/login broken · P1 logging failure or blocking confusion · P2 friction · P3 polish.
Status: new → understood → planned → fixed (with commit) → verified by tester.

| # | Date | Tester | What they said / saw | Our read | Sev | Status |
|---|---|---|---|---|---|---|
| 1 | 2026-11-04 | Tester (signup) | "email rate limit exceeded" on Sign Up, shown in teal | Supabase built-in email sender caps a few emails/hour per project. Not an app bug, but the message was raw and styled as success | P1 | **Fixed**: confirmation turned off for alpha (owner); friendly red errors + double-tap guard live in b846167. Before the 20-30 beta: custom SMTP, then confirmation back on |
| 2 | 2026-11-04 | Tester | "The problem is I don't know what the workout look like??" | Likely: doesn't know how to do the exercises (names only, no demo or instructions). Possibly: can't see what the workout contains before starting. Asked the tester which | P1 for beginners (blocks the first workout) | Understood, awaiting clarification |
