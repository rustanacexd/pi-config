---
description: Audit committed tests in a target, prune low-signal cases, and rewrite brittle tests around behavior
argument-hint: "<target>"
---
Read and follow `principle-test-behavior-not-implementation`.

Target: ${@:-none given. Ask me for one and stop without changing any files.}

Goal: leave a smaller suite where every retained test catches a regression in observable behavior, survives an internal refactor, and adds protection no other retained test provides.

A path or glob covers every committed test in it. A commit, commit range, or PR covers the tests it added or modified in their current form; check neighboring tests for overlap without editing untouched ones unless needed. List and count the original tests in scope, and read each beside the production code it exercises.

Give every original test in scope one verdict in this order:

1. **Delete** if another kept test catches the same break at least as quickly, reliably, and precisely, or if it covers no real caller-facing behavior worth keeping. Callers of an internal module count as users. Leftover scratch, debug, or migration tests, tests kept only for a test-only export, and source or import greps without a stated contract belong here.
2. **Keep** if it passes both imagined edits from the principle with concise setup and no redundant cases. A refactor that changes only imports or setup does not count against it.
3. **Rewrite** the rest, including bloated tests, coverage probes, and tests whose mocks implement the asserted behavior when they cover real caller-facing behavior no kept test protects. Preserve every caller-observable contract the original test protected, including downstream callers or outputs that depend on it. Drive the public interface, mock only external boundaries such as database, network, filesystem, clock, and third-party APIs, and keep the smallest clear set of cases.

Rules:

- Audit every test in scope. Trim hard, do not stop after easy cuts, and say why if little qualifies. There is no deletion quota.
- Before deleting a test as redundant, read its kept replacement and compare inputs, exercised behavior, and assertions rather than names or coverage. Confirm the replacement stays in the final suite. When redundancy is uncertain, check it with a temporary fault or keep the test and report the doubt.
- Never delete or weaken a failing test to pass the suite. Record baseline failures and any skipped tests left untouched, and investigate new failures as possible product bugs.
- Change only tests and test-only code. After checking all consumers across the repository, remove test helpers, fixtures, wrappers, and explicitly test-only exports orphaned by deletions or rewrites. Leave unlabelled production fields, return shapes, and runtime behavior intact. Do not refactor production code, fix product bugs inline, or add tests outside the target.

Verification and delivery:

- Record the starting `HEAD` commit, baseline test results, and baseline coverage if available before editing. Afterward, rerun affected tests with the same command, run related integration and end-to-end suites, and compare coverage under the same settings.
- Inspect every place that lost coverage to confirm the path is dead code or an intentional cut; restore a test if real behavior lost protection. Equal coverage does not prove protection held.
- Prove each rewrite, and any doubted redundancy, by injecting a temporary fault for each caller-observable behavior it protects, confirming the test fails, and restoring the code. Run fault checks sequentially in the working tree, or in an isolated worktree that already has the candidate test edits applied.
- Commit verified changes in clean green commits. Put deletions apart from rewrites when both exist, removing each orphaned helper or test-only export in the commit that removes its last consumer. Push or open a PR only when I ask.

Done when every original test has one verdict, every rewrite failed under its fault and was restored, every commit is green apart from recorded baseline failures, no temporary faults remain in the working tree, and `git diff <starting HEAD>..HEAD` confirms production files changed only to remove explicitly test-only exports or wrappers.

Report without a per-test scorecard: original tests in scope and counts deleted, rewritten, and kept, which must add up to that total; runner test counts, results, and coverage before and after; deletions and rewrites grouped by reason with close calls explained; notable tests kept and why; test and test-support lines removed; and any product bugs or open doubts.
