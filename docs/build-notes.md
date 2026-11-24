# BRSA Studio

## Division workspace revamp — 24 November 2026

Added dashboard home, persistent side navigation, hash-based tool/step navigation with browser history, planned Events/URL shortener views, and an accessible mobile drawer. Dashboard readiness and participant figures come from the current project/worksheet; export totals and neutral activity are session-only. No backend or participant persistence was introduced.

Certificates now supports a genuinely blank project with upload guidance, template-free project save/restore, explicit example provenance independent of editing, linked review checks, unsaved replacement protection, and clear download steps. Existing project files, uploads, text positioning, and PDF/ZIP engine remain compatible. Successful imports populate activity; cancelled exports are checked again before download/accounting.

HTML/CSS and artwork are authored in src and copied to dist during build. Existing certificate styling remains in style.css; workspace/navigation/dashboard adaptations live in workspace.css.

Verification: 13 Node tests; successful build; browser PDF (3 pages) and ZIP (3 individually named one-page PDFs) downloads inspected using pdf-lib/JSZip; blank and legacy project restoration; invalid restore preservation; PNG/PDF uploads; CSV/XLSX imports; missing-name export blocking; independent sample-flag clearing; keyboard text positioning and participant selection; browser history; mobile drawer active-destination/Escape/focus behavior; and dashboard/editor overflow checks at widths 360, 768, 1024, 1280, and 1600. Cancellation at 100% preparation produced no download or count increment. Fresh static review findings were addressed and rechecked. Deliberately invalid files and cancelled exports show expected in-app messages.

Default chosen by the user: build with bulk PDF downloads.

Browser application. Upload a PNG/JPEG or the first page of a PDF, import an XLSX/XLS/CSV file, choose the worksheet and participant-name column, and position mapped or fixed text on the design. Google Forms data is imported through its response spreadsheet export; no Google sign-in or automatic synchronization. Preview each row, then download a combined PDF or a ZIP of individual PDFs. Process files locally in the browser. No automatic emailing or shared server storage.

Visual direction updated 26 October 2026: a compact navy header with the original transparent Jata Negara artwork, project actions, and a clear three-step workflow. Palette: navy #17344d, white #ffffff, workspace #edf2f5, teal #087f75, brass #c69b49, muted #617384. Segoe UI for interface text; existing Helvetica and Times Roman PDF fonts retained. Upload and fields at left, certificate preview at center, selected-field settings at right. Tablet settings use a labeled grid; mobile tools and settings stack. Advanced position and width controls use a native disclosure. Clean-preview mode hides edit guides and removes canvas editing tab stops. Certificate sizing respects uploaded landscape and portrait aspect ratios.

Implementation: static HTML/CSS with bundled JavaScript. SheetJS reads workbooks, PDF.js renders PDF backgrounds, pdf-lib preserves PDF background pages and adds text, JSZip packages downloads. Standard PDF fonts avoid custom font subsetting failures. Characters outside standard encoding use a browser-rendered image. Export auto-fits text to its configured width. Individual filenames use each full name, with suffixes for duplicates. JSON project save/open retains template, recipients and field layout. Project files contain participant data, described in the save UI and README.

Verification: real XLSX and CSV imports including duplicate headers and quoted names; missing participant-name checks; text substitution; bounds and font fitting; output PDF page count and dimensions; browser sample workflow, uploads, layout editing, combined/individual downloads, project reopening, and narrow-screen layout. The ready-to-serve dist folder is included. GitHub source publication and hosted Site deployment are separate operations; the existing hosted Site remains owner-private.
