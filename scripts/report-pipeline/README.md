# Image 2 Report Pipeline

This pipeline turns child assessment materials, questionnaire answers, scores, methodology notes, and style references into a 24-page image-based PPT/PDF report package.

## Single Case

Default case:

```powershell
npm.cmd run report:image-pipeline
npm.cmd run report:image-pipeline:readiness
```

Named case:

```powershell
$env:REPORT_CASE="dingcheng"
npm.cmd run report:image-pipeline
npm.cmd run report:image-pipeline:readiness
Remove-Item Env:\REPORT_CASE
```

Named case folders:

- `inputs/cases/<case_id>/reports`
- `inputs/cases/<case_id>/questionnaire`
- `inputs/cases/<case_id>/scores`
- `inputs/cases/<case_id>/methodology`
- `inputs/cases/<case_id>/style_refs`
- `inputs/cases/<case_id>/extra_notes`

Outputs:

- `outputs/cases/<case_id>/analysis`
- `outputs/cases/<case_id>/deck`
- `outputs/cases/<case_id>/images`
- `outputs/cases/<case_id>/handoff`
- `outputs/cases/<case_id>/review`
- `outputs/cases/<case_id>/packages`

## Batch Cases

Run all folders under `inputs/cases/*`:

```powershell
npm.cmd run report:image-pipeline:cases
```

Run selected cases:

```powershell
$env:REPORT_CASES="dingcheng,student_b"
npm.cmd run report:image-pipeline:cases
Remove-Item Env:\REPORT_CASES
```

Batch summary:

- `outputs/case_batch/summary.md`
- `outputs/case_batch/summary.json`

## Image Generation

Generate one test image first:

```powershell
$env:REPORT_CASE="dingcheng"
$env:REPORT_BATCH="01"
$env:REPORT_IMAGE_LIMIT="1"
npm.cmd run report:image-pipeline:generate
Remove-Item Env:\REPORT_CASE
Remove-Item Env:\REPORT_BATCH
Remove-Item Env:\REPORT_IMAGE_LIMIT
```

Generate all 24 slides only after Batch 01 style is approved:

```powershell
$env:REPORT_CASE="dingcheng"
$env:REPORT_BATCH="all"
npm.cmd run report:image-pipeline:generate
Remove-Item Env:\REPORT_CASE
Remove-Item Env:\REPORT_BATCH
```

The script does not fake Image 2 results. If `OPENAI_API_KEY` is missing, it writes an image generation log and leaves manual prompts.

Image generation reads these variables from the process environment first, then from `.env.local` if they are not already set:

- `OPENAI_API_KEY`
- `IMAGE_MODEL`
- `IMAGE_SIZE`
- `IMAGE_QUALITY`
- `IMAGE_OUTPUT_FORMAT`

Only these Image 2 keys are loaded from `.env.local`; unrelated service keys are ignored by this pipeline.

## PDF And Image Intake

PDF, PNG, JPG, and JPEG files can enter the evidence chain in two ways:

- PDF files are first parsed by the built-in local extractor `scripts/report-pipeline/extract-text.py` when Python PDF libraries are available.
- Put a same-name sidecar text file next to the source, for example `talent-report.pdf.txt`, `score-screenshot.jpg.txt`, or `wrong-question.png.md`.
- Set `REPORT_TEXT_EXTRACTOR` to an executable parser/OCR command. The pipeline calls it with the source file path and reads stdout as extracted text.

If neither exists, the pipeline records the file in `source_manifest.json`, writes a parse warning, and blocks parent-release readiness until parsed assessment/questionnaire and parsed score/wrong-question evidence are available.

Manual extraction check:

```powershell
npm.cmd run report:extract-text -- inputs/cases/dingcheng/reports/talent-report.pdf
```

## Packaging

After images exist:

```powershell
$env:REPORT_CASE="dingcheng"
npm.cmd run report:image-pipeline
npm.cmd run report:image-pipeline:pdf
npm.cmd run report:image-pipeline:readiness
Remove-Item Env:\REPORT_CASE
```

Expected package files:

- `final_report_images.pptx`
- `final_images_zip.zip`
- `contact_sheet.svg`
- `final_report_preview.html`
- `final_report_preview.pdf`

Image packaging is release-gated by `review/image_audit.json` and `review/image_audit.md`. A slide must have:

- a 16:9 PNG/JPG/JPEG image at least 1200x675;
- a matching `slide_XX.prompt.txt`;
- either `slide_XX.generation.json` from API generation or a complete `slide_XX.manual-approved.txt` for manual Image 2 generation.

Manual Image 2 slides are not accepted by an empty marker file. Each `slide_XX.manual-approved.txt` must include:

```text
approved: true
no_logo: true
no_page_number: true
no_slide_index: true
no_pagination: true
chinese_readable: true
evidence_consistent: true
not_too_empty: true
not_too_crowded: true
not_over_marketing: true
no_score_guarantee: true
```

## Product Handoff

The pipeline also writes:

- `handoff/product_handoff.json`
- `handoff/product_handoff.md`
- `status/report_job_status.json`
- `status/report_job_status.md`

This file is the bridge back into the miniapp, app, and web product loop. It exposes five routes:

- `upload`: material classification and parse status
- `report`: evidence explanation, method matching, and report package status
- `tutor`: AI private tutor first-step questioning
- `review_game`: memory, day-7 retention, and transfer validation
- `parent`: parent evidence summary, next material request, and PDF/report package link

`status/report_job_status.json` is the stable product-facing job state. Miniapp, web, and app surfaces should read this status file instead of inferring readiness from individual folders. It separates:

- `needs_input_evidence`
- `waiting_for_image_generation`
- `needs_packaging`
- `needs_pdf_export`
- `needs_human_qa`
- `ready_for_parent_release`

When prompts are ready but slide images are missing, the status exposes `externalProviderRequired: true` and an `externalBlockers` entry for `OPENAI_API_KEY`. That is the intended stop line for work that cannot proceed without Image 2 or manual slide generation.

Product surfaces can read the same state through:

```text
GET /api/report-job-status?case_id=<case_id>
```

The miniapp client wrapper is `fetchReportJobStatus(caseId)` in `miniprogram/utils/api.js`.

PDF export tries Chrome/Edge first, then PowerPoint fallback. It writes `review/pdf_export_log.md` if no trusted renderer succeeds.

## Release Rule

Only send a report to parents when `review/readiness_report.json` says:

```json
{
  "status": "ready_for_parent_release"
}
```

Templates are not counted as real evidence. The readiness gate requires parsed real assessment/questionnaire evidence, parsed real score or wrong-question evidence, generated images, image audit pass, package files, PDF, QA checklist, `review/qa_approval.json`, and product handoff files.

To approve a parent-facing deck, copy `review/qa_approval.template.json` to `review/qa_approval.json`, fill reviewer metadata, set `approved: true`, and mark every listed check as `true` only after reviewing the generated slides.

## Questionnaire Fallback

If the child has no formal assessment report, put the child/parent answers under:

- `inputs/cases/<case_id>/questionnaire`

The pipeline writes `analysis/questionnaire_profile.md` before deck generation. It converts questionnaire text into a standard hypothesis layer:

- input preference;
- first-step/start behavior;
- likely stuck point;
- feedback preference;
- method candidates;
- validation gates.

Questionnaire output is intentionally confidence-gated. It can propose what to test first, but it cannot label a child or replace score, wrong-question, homework-process, or day-7 validation evidence.
