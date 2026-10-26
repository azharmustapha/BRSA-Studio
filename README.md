# BRSA Studio

A browser app to generate personalized program certificates from your own design and participant spreadsheet. All application code, fonts and libraries are bundled. Files are processed in your browser; the app does not upload participant data to a server.

## Use the app

1. Start with the sample project or upload a PNG, JPG or PDF certificate design. A PDF uses its first page. Use a blank design with space for personalized text; existing text cannot be erased automatically.
2. Open **Add participants** and upload an Excel workbook (`.xlsx` or `.xls`) or CSV. The first row must contain column headings. Choose your worksheet and participant-name column. Up to 500 participants and 100 columns per worksheet are supported.
3. For Google Forms, download the linked response spreadsheet as Excel or CSV, then upload that file. This is a manual snapshot import; this version does not connect directly to Google or sync new responses.
4. In **Design certificate**, select a field and map it to a spreadsheet column or enter fixed text. Fixed text supports `{{Column name}}` and `{{number}}`. Drag fields, or expand **Position & width** for precise placement and width controls. Arrow keys move a focused field; Shift + arrow moves it faster.
5. Browse participants below the preview, or select a participant row with a click, Enter, or Space. Use **Hide guides** to check the finished certificate and **Show guides** to resume positioning text. Long names automatically shrink to fit their field width. The app uses standard Times Roman and Helvetica PDF fonts. Characters outside the standard font encoding are rendered through the browser as an image, preserving how they appear in the preview.
6. Open **Review & export**. Download one combined PDF or a ZIP of individual PDFs named with each participant's full name, such as `Ahmad Farhan bin Ismail.pdf`. Repeated names receive a suffix, such as `Aina Sofea Abdullah (2).pdf`. Characters that are invalid in filenames are replaced with spaces. Missing participant names and unmapped columns block export. Repeated names are flagged for review and remain included.
7. **Save project** downloads a `.certstudio` file containing the design, fields, and participant data. **Open project** restores it. Work is kept in memory until saved; closing or refreshing the page discards unsaved edits. Keep saved project files private when they contain participant data.

Template uploads: 15 MB maximum, images up to 40 megapixels. Spreadsheet uploads: 10 MB maximum. Large designs and batches require more browser memory; split a list into smaller batches if needed. This version has no automatic email sending, live Google Forms synchronization, or shared database.

## Run locally

Requires Node.js 20 or later. The ready-to-use `dist/` folder is already built.

```powershell
node server.mjs
```

Open http://127.0.0.1:4173 in a modern browser. To rebuild after changing source:

```powershell
npm ci
npm test
npm run build
```

Deploy `dist/` to any static host, or publish through the Sites configuration in `.openai/hosting.json`. Run through HTTP rather than opening `index.html` directly, because PDF workers and font loading need it.

## Project structure

- `src/app.mjs`: interface, uploads, editable preview, project files, ZIP downloads.
- `src/core.mjs`: spreadsheet parsing, recipient checks, PDF template normalization and generation.
- `dist/`: ready-to-serve HTML, CSS, JavaScript, fonts, and PDF.js assets.
- `tests/core.test.mjs`: import and PDF generation tests.
- `build.mjs`: bundles the application and copies PDF.js assets.
- `server.mjs`: local static server.

Uses SheetJS CE 0.20.3, PDF.js, pdf-lib and JSZip. Uses standard fonts without custom font embedding.
