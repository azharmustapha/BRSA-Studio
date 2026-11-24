# BRSA Studio: workspace and certificate revamp

Status: approved by the user (“proceed”) and implemented. Builder check and final code review completed; verification recorded in docs/build-notes.md.

## Purpose

Make BRSA Studio the division's everyday workspace, beginning with a more approachable certificate generator and a dashboard. The user has requested side navigation and eventually wants certificate generation, URL shortening, event registration, and other useful tools in one place.

## Existing application and constraints

The application is a static browser application. `src/app.mjs` owns interface state and interactions; `src/core.mjs` owns spreadsheet parsing, validation, and PDF generation. HTML and CSS currently live in `dist/`. The build bundles JavaScript but does not recreate HTML or CSS. Participant data and certificate designs stay in browser memory. Project files provide explicit save and restore.

Preserve PNG/JPG/PDF templates, spreadsheet imports, column mapping, draggable fields, long-name fitting, keyboard editing, combined PDF and individual ZIP downloads, cancellation, and compatibility with existing `.certstudio` files. Preserve file and row limits and existing validation. No framework or backend migration is needed for this phase.

## Approaches

1. Cosmetic certificate refresh: least disruption, but does not provide the requested division dashboard or module navigation.
2. Shared workspace around the existing certificate engine: recommended. Adds the requested dashboard and navigation while improving a working certificate flow. This is the proposed implementation approach, not yet an approved user decision.
3. Full platform rebuild with accounts and server storage: supports shared links and registrations, but requires separate product, hosting, access, and retention decisions. Defer until those modules are addressed.

## First-phase scope

### Shared workspace

- Persistent left navigation: Dashboard, Certificates, Event registration, URL shortener. The latter two carry explicit “Planned” labels and lead to useful scope descriptions, with no fake create, publish, or registration actions.
- Dashboard is the initial view. Certificates opens the current project without resetting it. Navigation must retain all edits and participant selection.
- Header identifies the current area and exposes help. Certificate project actions appear within the certificate area and in the dashboard's current-project section where useful.
- Hash navigation supports browser back/forward and direct entry into dashboard, certificate steps, and planned-module views. Invalid hashes fall back to Dashboard. No server rewrite dependency.
- Mobile navigation uses a labeled menu button, `aria-expanded`, Escape-to-close, focus restoration, and a dismissible backdrop. Close it after choosing a destination. Provide a skip-to-content link and visible keyboard focus.

### Dashboard

Use accurate information from the current browser session, without invented division-wide statistics:

- Welcome and primary action: “Create certificates” or “Continue certificates,” based on current project state.
- Current project: project name, clearly labeled sample status, participant count, template status, mapped text-field count, and save reminder. Buttons resume the relevant step, open a project, or save the current project.
- Readiness checklist: design selected, participants added, names complete, field mappings valid; each actionable item links to its fixing step. Repeated names are a review warning rather than a blocker.
- Session summary: participants in the current worksheet; certificates successfully generated this session; successful export batches this session. Explain that counts reset on refresh. Samples are explicitly labeled. Count completed generation only, never failed/cancelled work. These are generated files, not proof of printing, delivery, or receipt.
- Recent session activity: actual imports, project opens/saves, and completed exports, newest first, capped at ten. Use neutral descriptions without participant names. Empty state gives the next useful action. No persistent participant storage is introduced.
- Tools section: Certificates available; Event registration and URL shortener planned. Each planned tool explains its intended purpose without suggesting it already works.
- A concise getting-started guide and reminder to save before closing.

No decorative trend charts, fabricated event counts, unimplemented notifications, or user/account controls.

### Certificate generator

Keep three predictable stages, with clear active state and explicit next/back actions:

1. **Design**: upload a background or try the clearly labeled sample. Explain that existing background text cannot be removed. Name the project. Keep the preview central; list selectable fields to its left and selected-field settings to its right on wide screens. Use friendly labels, a contextual hint for spreadsheet mapping, and advanced position/width controls behind a disclosure.
2. **Participants**: prominent Excel/CSV upload and downloadable sample; worksheet and name-column mapping; searchable participant table; understandable missing-name and repeated-name warnings. Clicking a row opens that participant's preview. Clarify the manual Google Forms spreadsheet import.
3. **Review & download**: show design, participant total, mapped fields, and a small finished-preview summary/shortcut. Validation issues link back to the relevant step. Explain PDF versus ZIP in plain language. Keep progress, cancellation, completion feedback, and the save-project prompt visible and understandable.

Design and preview remain usable with the example before importing a real list. Provide a “New certificate project” action that starts a blank project with an initial name field and no participants or background; confirm before discarding unsaved work. A blank preview explains how to upload a design. Do not export the sample accidentally through a misleading “new project” action.

Builder decisions from review: allow saving and restoring a template-free project using `template: null` in the existing version-1 file format, while retaining older project compatibility. Track sample-template and sample-participant provenance separately from the dirty/save state: moving a field does not turn example participants into real participant data. Importing a real list clears only the sample-participant indicator; uploading a real background clears only the sample-template indicator. Export review explicitly identifies any remaining example data.

Project replacement, opening a different file, or loading the sample must protect unsaved edits. Leaving for another workspace section does not discard edits or require confirmation. Guard destructive editing/replacement actions while generation is running. Failed uploads/restores must leave the current project usable.

## Visual design

Maintain the existing BRSA identity and Jata Negara artwork. Use navy `#17344d` for navigation, teal `#087f75` for primary actions and readiness, brass `#c69b49` sparingly for certificate identity, workspace grey `#edf2f5`, white `#ffffff`, and muted text `#617384`. Segoe UI remains the interface font; certificate font choices remain unchanged.

Use a roughly 232 px desktop navigation rail and a flexible content area. Left-align page titles, forms, and dashboard content. Distinguish hierarchy through spacing and type size rather than giving every item the same card treatment. Group operational metrics in one compact strip; give the current project and readiness checklist the largest dashboard area. The certificate preview remains the dominant editor element. Retain readable contrast, reduced-motion support, and usable controls down to a 360 px viewport.

```text
Desktop dashboard
┌────────────────┬───────────────────────────────────────────┐
│ BRSA Studio    │ Dashboard                          Help   │
│                ├───────────────────────────────────────────┤
│ Dashboard      │ Your division workspace   Create certificates│
│ Certificates   │ Session totals (clearly scoped)            │
│ Events Planned │ Current certificate project │ Readiness   │
│ Links  Planned │ Available and planned tools               │
│                │ Session activity            │ Quick guide │
└────────────────┴───────────────────────────────────────────┘

Desktop certificates
┌────────────────┬───────────────────────────────────────────┐
│ Shared         │ Certificates                Open / Save   │
│ navigation     │ Project name / save state                 │
│                │ Design → Participants → Review & download │
│                │ Template / fields │ Preview │ Text settings│
│                │ Contextual help              Next step    │
└────────────────┴───────────────────────────────────────────┘
```

On tablet, reduce the rail footprint and move settings beneath the preview as needed; on mobile use the menu drawer and stack editor sections, without shrinking form controls or overflowing the page. Only the participant table may scroll horizontally.

## Implementation boundaries

Keep the existing dependencies and static hosting compatibility. Move authored HTML/CSS into `src/` and have `build.mjs` copy them into `dist/`, ensuring reproducible builds while retaining deployment output. Isolate session activity/counting and routing helpers where that makes meaningful tests possible. Never write participant data to localStorage. No automatic save or restoration is promised.

Implementation choices left to the builder: icon details within the existing SVG sprite system, exact spacing, small copy refinements, and module boundaries. Preserve artwork attribution. No publishing, dependency upgrades, or account integrations are included.

## Acceptance and verification

- Existing core tests pass; build succeeds from source.
- Verify dashboard counts and readiness against empty, sample, imported, invalid, and restored projects. Counts update only after successful exports and remain unchanged on cancellation/failure.
- Verify navigation, browser history, direct hash entry, and returning to an edited certificate without losing work.
- Exercise PNG/PDF template upload, CSV/XLSX import, mapping, selected participant preview, text editing and positioning, and both PDF/ZIP generation.
- Verify save/open round trip and old project compatibility, new-project empty state, unsaved-replacement confirmation, and failed-file recovery.
- Inspect desktop and narrow mobile layouts, keyboard navigation/focus, menu dismissal, and absence of page-wide horizontal overflow or browser errors.
- Update README and build notes with the workspace, session-only metrics, planned modules, and revised workflow.

## Later phases

Event registration needs decisions about public forms, registration fields, capacity, duplicate handling, access, and data storage. A URL shortener needs a domain, hosted redirect service, link ownership, and lifecycle rules. These will be designed separately when the user asks to implement them. Their dashboard totals become available when real services exist.
