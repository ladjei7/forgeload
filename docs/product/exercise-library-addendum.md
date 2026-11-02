# FORGELOAD — EXERCISE LIBRARY EXPANSION AND INTELLIGENT SEARCH ADDENDUM

This is a new, high-priority requirement for the existing ForgeLoad product specification.

The application currently has approximately 149 exercises. We need to expand this into a comprehensive, professionally structured, searchable, and customizable exercise catalog that supports personalized program generation, reliable workout logging, exercise substitutions, and progression analysis.

## 1. Product objective

Target approximately 700–1,000 or more distinct, useful exercises and meaningful variations over time.

The objective is not to inflate the count. It is to offer comprehensive coverage of real-world gym exercises.

Avoid unnecessary duplicates, poorly classified exercises, fabricated variations, and entries that differ only by naming conventions.

Preserve all existing exercises, their identifiers, user references, workout plans, and historical logs.

## 2. Research and evaluate exercise datasets

Investigate these starting sources:

1. RepDB: https://github.com/RepDB/exercise-dataset
2. Free Exercise DB: https://github.com/yuhonas/free-exercise-db
3. wger: https://github.com/wger-project/wger

Evaluate:

- Exercise coverage.
- Metadata completeness.
- Instruction quality.
- Media availability.
- Accuracy of muscle classifications.
- Duplicate entries.
- Commercial licensing rights.
- Attribution requirements.
- Long-term maintainability.
- Suitability for ForgeLoad's existing architecture.

RepDB is my preferred initial candidate to investigate because its free dataset currently advertises 701 illustrated exercises and commercial in-app usage rights with attribution.

However, do not select it automatically.

Inspect its actual content and full license.

Its free license restricts redistribution of the dataset and prohibits using its images for generative-AI derivation. Do not publish an imported proprietary or redistribution-restricted dataset in our public GitHub repository or expose a bulk-download endpoint.

Also inspect media rights independently for other sources. A repository license alone does not necessarily establish ownership of every image.

Do not use ExerciseDB API data for persistent storage without a license that explicitly permits our intended use.

Present a source comparison and recommended import strategy before any production import.

## 3. Build a canonical exercise model

Every exercise should have a stable internal identifier and appropriately structured metadata.

Consider:

- Canonical exercise name.
- Alternative names and search aliases.
- Primary muscle group.
- Secondary muscle groups.
- Equipment category.
- Movement pattern.
- Exercise category.
- Compound or isolation classification.
- Beginner/intermediate/advanced suitability.
- Unilateral versus bilateral classification.
- Default tracking type.
- Load-recording convention.
- Relevant exercise relationships.
- Instructions and coaching cues.
- Optional licensed demonstration media.
- Source and attribution metadata.
- Review/verification status.
- Availability for automated plan generation.

Where useful, support tracking modes such as:

- Weight and repetitions.
- Bodyweight repetitions.
- Added-weight bodyweight repetitions.
- Assisted bodyweight repetitions.
- Duration.
- Weight and duration.
- Distance and duration.

Do not mix incompatible exercise types under one tracking model.

For dumbbells and unilateral movements, clearly define whether entered loading is per implement, per side, or total.

Exercise identity must remain stable through renaming and catalog updates.

## 4. Preserve existing user data

Audit the existing exercise schema and its relationships before making modifications.

Create a mapping process between current ForgeLoad exercises and the expanded catalog.

If an existing movement already corresponds to an imported movement, prefer a canonical mapping rather than an unnecessary duplicate.

Do not automatically merge exercises with materially different biomechanics, loading conventions, or progression histories.

Provide migration scripts, mapping reports, duplicate detection, and rollback guidance.

No existing user workout data should be deleted or silently reassigned.

## 5. Create an excellent search experience

Build one reusable exercise-selection interface that works in:

- The Plan editor.
- The active Log page.
- Exercise substitution.
- A standalone exercise library.

Required capabilities:

- Responsive instant search.
- Partial-name matching.
- Common abbreviations.
- Exercise aliases.
- Typo tolerance.
- Muscle-group filters.
- Equipment filters.
- Movement-pattern filters where useful.
- Recently used exercises.
- Favorite exercises.
- Custom exercises.
- Clear empty-search states.
- Convenient creation of a missing exercise.
- Mobile-friendly selection without losing the current workout.

Examples:

- "RDL" should find Romanian deadlift variations.
- "Lat pulldown" should show relevant pulldown variations.
- "Incline chest" should find relevant incline pressing exercises.
- "Cable curls" should return appropriately related cable biceps exercises.

Rank exact and highly relevant results above loosely related matches.

Consider PostgreSQL full-text search and `pg_trgm` if appropriate. Avoid adding an external search service without a demonstrated need.

Set search-performance targets and verify them on realistic devices and data.

## 6. User-created exercises

Allow unlimited custom exercise creation in ForgeLoad Free.

Required fields:

- Exercise name.
- Primary muscle.
- Equipment.
- Tracking type.

Optional fields:

- Secondary muscles.
- Instructions.
- Personal notes.
- Media where permitted.
- Search aliases.
- Exercise classification.

Users must be able to edit, duplicate, archive, and reuse their custom exercises.

Custom exercises must be private to their owners unless an explicit future sharing feature is introduced.

Apply Supabase row-level security and ownership checks.

Do not allow users to modify global canonical records through custom-exercise editing.

Do not erase historical logs when a custom exercise is archived.

## 7. Personalized workout generation integration

The expanded catalog must integrate with the planned beginner onboarding.

The recommendation engine should use:

- Experience level.
- Fitness goal.
- Weekly training frequency.
- Workout duration.
- Exercise preferences.
- Available and appropriate gym equipment.

However, do not let the generator select arbitrarily from all imported exercises.

Create a reviewed, recommendation-eligible subset.

Select movements using:

- Appropriate movement patterns.
- Training goal.
- Experience suitability.
- Muscle coverage.
- Exercise complexity.
- Exercise variety.
- Practical workout duration.
- Available substitution relationships.

Do not generate unusual combinations merely because metadata says an exercise targets the correct muscle.

Every generated exercise should have a meaningful purpose in the workout.

All generated exercises must remain editable and replaceable.

## 8. Intelligent exercise substitution

When replacing an exercise, rank alternatives by:

1. Training purpose and target muscles.
2. Movement pattern.
3. Equipment.
4. Similarity of execution and loading.
5. Experience suitability.
6. User preferences and history.

For example, replacing an incline dumbbell press might suggest an appropriate incline machine or Smith machine press.

It should not present a cable fly as a mechanically equivalent pressing movement merely because both involve the chest.

Explain relevant differences.

Keep separate performance histories for different exercises unless a carefully defined equivalence rule justifies otherwise.

## 9. Exercise details interface

A selected exercise should display:

- Name.
- Primary and secondary muscles.
- Equipment.
- Optional instructional image or animation.
- Concise technique instructions.
- Applicable tracking mode.
- User history.
- Personal records.
- Appropriate alternatives.

Prioritize reliable, licensed content.

If visual demonstrations are missing or unverified, don't display misleading or fabricated examples.

Consider curated original demonstrations as a future quality-improvement initiative.

## 10. Data quality pipeline

Implement a reproducible import and validation process.

Include:

- Dataset source tracking.
- License review.
- Schema validation.
- Canonical naming.
- Alias mapping.
- Duplicate detection.
- Muscle/equipment taxonomy normalization.
- Missing-field reporting.
- Invalid-media detection.
- Instruction review.
- Import versioning.
- Rollback or recovery.
- Review status for program-generation eligibility.

Produce a report that distinguishes:

- Raw imported records.
- Accepted canonical exercises.
- Rejected entries.
- Merged duplicates.
- Existing entries preserved.
- Entries requiring further review.
- Exercises approved for automated program generation.

Do not claim 1,000 quality exercises if only 600 passed validation.

## 11. UI quality

Design the exercise library to match ForgeLoad's premium, modern, dark-mode visual direction.

Prioritize:

- Fast browsing.
- Clear exercise names.
- Consistent thumbnails where licensed.
- Equipment and muscle labels.
- Efficient filters.
- Minimal taps to add exercises.
- Simple multi-selection for program building.
- Clear custom-exercise creation.
- Excellent mobile usability.

Do not sacrifice logging performance to load the entire catalog and every image upfront.

Use pagination or virtualization when justified.

Lazy-load demonstration media.

## 12. Monetization

The following should remain free:

- Full core exercise catalog.
- Search and filters.
- Unlimited custom exercise creation.
- Adding and replacing exercises.
- Exercise instructions where available.
- Using exercises in editable workout programs.

Premium monetization should focus on advanced progression insights, analytics, and programming intelligence—not access to ordinary exercises.

## 13. Testing and acceptance criteria

Before calling the feature complete, verify:

1. Existing 149 exercises are preserved or safely mapped.
2. Historical workout records remain accurate.
3. Imported records have valid canonical IDs.
4. Duplicate entries are identified.
5. The final catalog count is accurate and documented.
6. Search recognizes common aliases and abbreviations.
7. Filters return correct results.
8. Custom exercise creation works.
9. Custom exercise data is isolated per user.
10. Exercise selection works in both Plan and Log.
11. Replacements preserve unrelated workout data.
12. Generated plans use only approved exercises.
13. Missing media does not break the interface.
14. Search remains responsive on mobile.
15. Licensing and attribution requirements are satisfied.
16. The application passes relevant builds, tests, and security checks.

## 14. Execution

Begin with a repository and dataset audit.

Recommend the best compliant data source and explain why.

Create a safe import/migration strategy.

Build and validate the expanded library on a separate feature branch.

Avoid destructive production database operations without my approval.

Share an implementation summary, verified exercise count, duplicate report, source/license documentation, test results, and a preview URL when available.

Do not merge to main without approval.

**Final objective: ForgeLoad should have a large exercise library that is genuinely useful, exceptionally easy to search, extensible through custom exercises, and dependable enough to power personalized workout generation and long-term progressive-overload tracking.**
