---
name: release-readiness
description: Reviews a proposed release against repository evidence and creates a concise, actionable checklist. Use before tagging, packaging, or announcing a release.
---

# Release Readiness

Help prepare a release from the current repository state. This is a review and planning skill: it does not publish, tag, deploy, or edit release metadata unless the user separately requests that action.

## Workflow

1. Read repository guidance and identify the product/version source of truth.
2. Inspect the current branch, working tree, recent commits since the last release/tag, changelog, manifests, CI workflows, and release scripts.
3. Compare version values across manifests and docs. Do not assume the newest version or release branch.
4. Check whether tests/builds are recorded as passing in current evidence. If not run or visible, mark them unverified; do not claim green.
5. Draft a checklist grouped into ready, needs attention, and unknown. Link each finding to a file/commit/workflow.
6. Offer a draft release note assembled only from user-facing changes. Label breaking changes only when evidence supports them.

## Guardrails

- Never create tags, releases, packages, deployments, or announcements without explicit user instruction.
- Do not modify version files or changelogs as part of review-only work.
- Treat uncommitted changes as part of the proposed release only if the user says they should be included.
- Avoid overstating security, compatibility, or test coverage.

## Output shape

### Ready
Verified items that appear complete.

### Needs attention
Specific blockers with path and suggested action.

### Not verified
Missing evidence, including CI or platform checks.

### Release note draft
Short user-facing summary, with any uncertain item excluded or marked.

