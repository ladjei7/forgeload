# Design system v0 (hybrid)

## Tokens (dark | light)
| Role | Dark | Light |
|---|---|---|
| bg | #101419 | #F6F5F1 |
| surface | #1C232C | #FFFFFF |
| surface 2 | #252D38 | #ECEAE3 |
| line | #3B4757 | #D5D3CB |
| field border | #6F7C8E (3.7:1) | #8A93A1 (3.1:1) |
| text | #F7F8FA | #12161C |
| text 2 | #A6B0BD (7.2:1) | #4A5361 (7.1:1) |
| accent (next action, target) | #FF7043, text on it #101419 (6.7:1) | #BF360C, text on it #FFFFFF (5.6:1) |
| progress | #39BBA5 | #167A57 |
| alert | #FF8A80 | #B3261E |
Rule: accent marks the one next action. Progress color means progress only. Never color alone: set state also changes fill, outline style and label.

## Type
Geist (self-hosted via the `geist` package, preview-only). Tabular numerals everywhere numbers change. Scale: 44 (focus target), 30, 28, 20, 16, 14, 12 (minimum).

## Components in the preview
Sheet (bottom, Escape, focus return), Stepper, Switch, Pill/segmented, SyncChip, Target block, Set row (planned, current, saving, saved, queued, failed), Focus entry, Rest row, Dock, Toast with Undo, Option card, Library row, Rotation pill.

## Implementation sequence (after approval; each step is its own branch and preview)
1. Tokens and font in the real app (CSS variables, `geist`, light theme switch); no layout change.
2. New nav (5 tabs, active state, SVG icons) and Home.
3. Logger: target block, one-tap log, rest dock, then Focus mode behind a setting.
4. Durable local save queue plus sync states (this is the real work behind "Saved / Offline / Not saved").
5. Plan editor and rotation controls; library polish; onboarding review step.
6. Completion screen, Progress, credits screen for the exercise library licence.
Each step keeps current data and routes working; nothing is rewritten at once.

## Not decided yet
Logo and wordmark, F mark refinement, exact copy, whether Focus is the default, light theme default (follow system), RIR wording.
