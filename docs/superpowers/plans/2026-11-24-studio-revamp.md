# BRSA Studio Revamp Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the approved dashboard, navigation, and approachable certificate workflow.
**Architecture:** Keep the static application and existing PDF engine. Extract route/readiness/session logic to a small testable module; keep DOM editing in app.mjs and authored HTML/CSS in src.
**Tech stack:** Browser JavaScript, CSS, esbuild, existing PDF.js/pdf-lib/SheetJS/JSZip.
**Spec:** docs/superpowers/specs/2026-11-24-studio-revamp-design.md (approved by “proceed”).

## Global constraints

- Preserve existing project compatibility and browser-only participant handling.
- No dependency upgrades, hosting changes, or fabricated analytics.
- Events and links remain explicitly planned modules.
- Responsive down to 360 px; accessible navigation and focus.

## Review focus

- Blank projects must save and restore without a template.
- Editing a sample must not remove sample-data warnings.
- Failed/cancelled exports must not increase totals.
- Back/forward and mobile menu navigation must preserve edits and focus.
- Failed imports must not destroy a valid current project.

## Task 1: Workspace model

Files: src/workspace.mjs, tests/workspace.test.mjs.
Interfaces: parseRoute(hash) -> {area,step}; projectReadiness({template,fields,sheet,nameColumn}) -> checklist; createSession() -> {activity,certificates,batches,record,exported}.

- [x] Write tests for invalid/direct routes, missing/invalid mappings, empty projects, capped activity, and successful-export counters; run them and observe missing-feature failures.
- [x] Implement helpers, run npm test, confirm all pass.

## Task 2: Workspace and certificate interface

Files: src/index.html, src/style.css, src/app.mjs, build.mjs; generated dist assets.
Consumes Task 1 interfaces. Produces dashboard, hash navigation, planned-module pages, mobile drawer, revised editor and empty project handling.

- [x] Move authored HTML/CSS to src and copy them during build.
- [x] Build sidebar, dashboard, session rendering, route/focus management, and honest planned-module pages.
- [x] Add blank projects, sample provenance, safe replacement, nullable-template save/restore, linked review checks, and export session accounting.
- [x] Run tests/build and browser checks for sample/blank/edit/navigation/export/project restore and 360 px layout.

## Task 3: Verification and delivery

Files: README.md, docs/build-notes.md, specification/plan status.

- [x] Review the whole change with a fresh reviewer, address material findings, and verify changed behavior.
- [x] Run npm test and npm run build; check desktop/mobile screenshots and browser console.
- [x] Document session-only metrics, planned tools, and build/source workflow. Leave changes in the current checkout for user review; no publish or push requested.

## Execution ledger

Ruling: use the current checkout per desktop workspace instructions; user authorized implementation with “proceed.” No worktree or integration action is required.
Ruling: execute inline; continuing the already approved design does not require a second approval for this plan.
Pre-flight: Task 2 consumes Task 1 route, readiness and session interfaces; Task 3 verifies those user-facing behaviors.

Task 1: complete — observed missing-module test failure, implemented helpers, all 13 tests pass.
Task 2: complete — responsive workspace/editor, routing, null-template projects, provenance, and session accounting verified in browser.
Task 3: complete — fresh review findings fixed/rechecked; final tests 13/13, build successful, documentation updated.
Ruling: generated SheetJS bundle contains whitespace inside a literal string; preserve its bytes. Authored-file diff whitespace checks pass. No push, merge, or deployment performed.
