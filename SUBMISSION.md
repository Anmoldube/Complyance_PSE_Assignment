# Submission

- **Name:** Anmol Dube
- **Date submitted:** 2026-11-13
- **Repository link:** local workspace `pse-support-lab`
- **Total time spent (real time):** approximately 3.5 hours

> Replies below are drafts written on the exercise clock: Monday 16 November 2026, Asia/Dubai.

- **Items I fully investigated, and why I chose them:** I fully investigated all five. Incident 2 was the highest-risk platform issue. Incidents 1, 3, and 4 had customer-impacting product defects or data repair needs. Incident 5 was quick to confirm and resolve with customer guidance.

---

## Incident 1 - `inbox/01-oasis-builders-upload-stuck.md`

### Acknowledgement

- **Sent at (exercise clock):** 09:12 GST
- **Reply:**

> Hi Oasis team, we are investigating the stuck upload and duplicate risk now. Please do not retry `oasis-builders-nov-2026.xlsx` again while we check the import state and invoice numbers. I will confirm whether any invoices were already accepted before advising next steps.

### Priority and justification

- **Priority:** P2
- **Why:** One important customer is blocked during month-end and repeat uploads can create duplicate/confusing import state. It is not initially confirmed as a platform-wide outage, but it has serious customer impact.
- **SLA deadlines I am working to:** first response by 10:05, next update by 11:05, target resolution/workaround same business day.

### Investigation log

| Time (exercise clock) | What I checked / did | What I found |
|---|---|---|
| 09:15 | Checked customer report and workbook name. | Large 600-line upload stuck in `Processing`; customer retried several times. |
| 09:35 | Ran replay and queried Oasis imports. | One import completed with 600 rows, 8 invoices, duration about 122 seconds. |
| 09:45 | Checked invoice status for the completed import. | All 8 invoices were `Accepted`. |
| 10:00 | Re-uploaded the Oasis sample to reproduce error page behavior. | Client received `Empty reply from server`; API restarted and left a new import in `Processing` with 0 rows. |
| 10:15 | Reviewed upload/import/cache code. | Upload work runs synchronously, reads full file into memory, and stores raw/workbook/invoices in an unbounded in-memory cache. |

### Root cause

- **What happened:** The first upload completed but was very slow. A later retry hit an API restart and left a second import stuck in `Processing` with no parsed rows.
- **Where:** `services/api/internal/httpapi/httpapi.go` upload handler; `services/api/internal/importer/importer.go`; `services/api/internal/importer/sources.go`.
- **Why it happens:** The import path is synchronous and memory-heavy. Large workbooks remain in request processing long enough to look stuck, and API restarts can strand in-progress import records.
- **Evidence:** [evidence/incident-01-oasis-upload-stuck.md](evidence/incident-01-oasis-upload-stuck.md)
- **Confidence and open questions:** High confidence on slow/stuck import behavior. Open question: whether production has persisted source files to replay the stuck import or only enough metadata to mark it failed.

### Customer resolution reply OR escalation note

- **Which one and why:** Escalation plus customer update. Customer needs reassurance and engineering/data repair is required for the stuck retry.

> Hi Oasis team, we found that one upload of `oasis-builders-nov-2026.xlsx` completed and 8 invoices were accepted. A later retry hit an API restart and left a second import stuck in `Processing`, so please do not upload the file again while we clean up the stuck attempt. We are escalating this to engineering for import recovery and performance fixes, and we will confirm the final invoice list before any retry is attempted.

### Workaround offered

Do not re-upload. Support/engineering should confirm the accepted invoice list from the completed import, then cancel or mark failed the stuck import after verifying it created no invoices.

### Prevention ideas

Move imports to durable async jobs, add recovery for imports left in in-progress states, cache participant lookups per import, and expose clearer progress for large files.

---

## Incident 2 - `inbox/02-alert-api-restarted-marina-bay.md`

### Acknowledgement

- **Sent at (exercise clock):** 09:55 GST
- **Sent to:** Priya / support-oncall
- **Reply:**

> We are treating this as P1 platform instability. On-call is checking API restarts, failed uploads, and invoices stuck after validation. Please avoid asking customers to retry large batches until we confirm which imports are safe to replay. Next update in 30 minutes.

### Priority and justification

- **Priority:** P1
- **Why:** API restarts and upload 502s affect core production functionality. Invoices were left in non-terminal states, and the issue was not limited to one customer template.
- **SLA deadlines I am working to:** first response by 10:12, 30-minute updates, resolution or mitigation target by 13:42.

### Investigation log

| Time (exercise clock) | What I checked / did | What I found |
|---|---|---|
| 09:55 | Checked alert/support report. | API restarted three times; Marina Bay saw 502s and invoices not moving beyond `Validated`. |
| 10:05 | Ran load replay. | Peak replay had 21 failed uploads out of 240, including EOF and connection errors. |
| 10:15 | Inspected container state. | API restart count increased; API had restarted more recently than dependencies. |
| 10:25 | Queried invoice states. | Many invoices remained in `Parsed`, `Validated`, or `Submitted`; Marina had invoices in all these states. |
| 10:40 | Reviewed upload, cache, submitter, ASP code. | Import is synchronous/memory-heavy; submitter has no 429 handling even though ASP returns 429 with `Retry-After`. |

### Root cause

- **What happened:** Concurrent uploads caused API restarts and client-facing upload failures. Some invoices remained in non-terminal states after restarts or throttled submission attempts.
- **Where:** `services/api/internal/httpapi/httpapi.go`, `services/api/internal/importer/sources.go`, `services/api/internal/submit/submit.go`, `services/asp-mock/main.go`, `docker-compose.yml`.
- **Why it happens:** The API reads full uploads into memory, processes imports synchronously, stores large artifacts in an unbounded process-local cache, and runs with a 128 MiB memory limit. Separately, HTTP 429 from the ASP is not retried or failed safely.
- **Evidence:** [evidence/incident-02-api-restarts-marina.md](evidence/incident-02-api-restarts-marina.md)
- **Confidence and open questions:** High confidence that restarts and missing 429 handling explain observed behavior. The exact production restart trigger should be confirmed from memory metrics/core logs, but the local reproduction matches the alert symptoms.

### Customer resolution reply OR escalation note

- **Which one and why:** P1 engineering escalation. This is active platform instability with user-visible failures.

> P1 escalation: API upload path restarts under concurrent load. Reproduction: peak replay generated 21 failed uploads and increased API restart count. DB shows invoices stranded in in-progress states. Suspected causes are synchronous upload/import processing, unbounded source cache under 128 MiB API memory limit, and missing ASP 429 handling. Impact: Marina Bay upload 502s and stalled invoices. Please prioritize mitigation, stuck-state recovery, and 429 retry/backoff.

### Workaround offered

Temporarily avoid bulk re-uploads. Support should identify stuck imports/invoices before replaying anything and retry only records proven safe and idempotent.

### Prevention ideas

Use durable async import jobs, bound memory/cache, recover stuck imports on startup, handle 429 with backoff, and alert on API restarts plus invoices stuck in `Submitted` without ASP message IDs.

---

## Incident 3 - `inbox/03-al-noor-fuel-br-co-15.md`

### Acknowledgement

- **Sent at (exercise clock):** 10:28 GST
- **Reply:**

> Hi Al Noor team, we reproduced the BR-CO-15 rejects and are checking generated totals against the workbook and ASP response. No need to change the file until we confirm root cause, because this may be in our PINT generation rather than your spreadsheet.

### Priority and justification

- **Priority:** P2
- **Why:** Several invoices for one customer are rejected by the ASP and the customer has an audit deadline. The data appears valid, so this needs product escalation.
- **SLA deadlines I am working to:** first response by 11:15, next update by 12:15, same-day mitigation target.

### Investigation log

| Time (exercise clock) | What I checked / did | What I found |
|---|---|---|
| 10:30 | Queried Al Noor invoice statuses and ASP errors. | 3 accepted and 3 rejected with BR-CO-15. |
| 10:45 | Recalculated workbook totals using decimal arithmetic. | Rejected invoices had correct rounded net plus rounded VAT totals. |
| 11:00 | Compared generated total logic with ASP expected behavior. | App rounds `gross` independently instead of using rounded net plus rounded VAT. |
| 11:10 | Checked whether this was customer formatting. | Not a template issue; failure is in generated PINT monetary totals. |

### Root cause

- **What happened:** The API generated PINT totals where `TaxInclusiveAmount` was 0.01 or 0.02 lower than the ASP expected total.
- **Where:** `services/api/internal/pint/pint.go`.
- **Why it happens:** Gross is calculated from unrounded line math and rounded at the end, while `TaxExclusiveAmount` and `TaxAmount` are rounded separately. Fuel unit prices with 3 decimals expose the inconsistency.
- **Evidence:** [evidence/incident-03-al-noor-br-co-15.md](evidence/incident-03-al-noor-br-co-15.md)
- **Confidence and open questions:** High confidence. Open question: whether production should regenerate only rejected invoices or all invoices from that upload after the fix.

### Customer resolution reply OR escalation note

- **Which one and why:** Escalation. Customer data is valid; product generated invalid totals.

> Hi Al Noor team, we found that your workbook totals are consistent. The issue is in our generated PINT totals for some fuel rows with 3-decimal unit prices. We are escalating this as a product defect and will advise before asking you to resubmit; please do not manually alter invoice totals to work around it.

### Workaround offered

No customer-side total changes recommended. After fix, regenerate and resubmit only the rejected invoices.

### Prevention ideas

Add regression fixtures for 3-decimal unit prices and assert PINT `TaxInclusiveAmount == TaxExclusiveAmount + TaxAmount` under the ASP rounding model.

---

## Incident 4 - `inbox/04-bluepeak-sahara-not-received.md`

### Acknowledgement

- **Sent at (exercise clock):** 11:40 GST
- **Reply:**

> Hi BluePeak/Sahara team, we see the batch import completed but only part of the batch has ASP references. Please do not re-upload the full batch; we are checking ASP delivery and retry state so we can avoid duplicates.

### Priority and justification

- **Priority:** P2
- **Why:** A production batch partially delivered to the ASP and buyer receipt is incomplete. It affects one customer but involves financial document delivery and duplicate risk.
- **SLA deadlines I am working to:** first response by 12:30, next update by 13:30, same-day mitigation target.

### Investigation log

| Time (exercise clock) | What I checked / did | What I found |
|---|---|---|
| 11:40 | Queried Sahara batch import. | Import completed with 40 invoices. |
| 11:50 | Checked invoice statuses and ASP references. | First 8 were `Accepted`; remaining 32 were `Submitted` with no ASP message ID. |
| 12:00 | Checked API/ASP logs. | ASP returned HTTP 429 rate-limit responses. |
| 12:10 | Reviewed submitter code. | Submitter has no explicit 429 handling or retry path. |

### Root cause

- **What happened:** The ASP accepted the first 8 invoices, then rate-limited the sender. The API left the remaining 32 invoices in `Submitted` without ASP references.
- **Where:** `services/api/internal/submit/submit.go`; `services/asp-mock/main.go`.
- **Why it happens:** ASP returns 429 with `Retry-After`, but the submitter only handles success, validation rejection, and selected 5xx statuses.
- **Evidence:** [evidence/incident-04-sahara-submitted-429.md](evidence/incident-04-sahara-submitted-429.md)
- **Confidence and open questions:** High confidence. Need production ASP confirmation for exactly which 8 message IDs were accepted before retrying the other 32.

### Customer resolution reply OR escalation note

- **Which one and why:** Escalation. The system needs safe retry/requeue for stuck invoices.

> Hi Sahara team, we confirmed your batch was imported, but only the first 8 invoices received ASP references. The remaining 32 are stuck in our submitted state after ASP throttling and should not be re-uploaded as a full new batch. We are escalating this for a safe retry/requeue of only the invoices that have no ASP reference, then we will send you the final accepted list.

### Workaround offered

Do not re-upload the full batch. Support/engineering should retry only invoices without ASP message IDs after confirming accepted invoice IDs.

### Prevention ideas

Handle 429 with `Retry-After`, keep throttled invoices retryable, and add an alert for `Submitted` invoices with null ASP message IDs beyond a short threshold.

---

## Incident 5 - `inbox/05-ghaf-cafe-date-error.md`

### Acknowledgement

- **Sent at (exercise clock):** 12:25 GST
- **Reply:**

> Hi Ghaf Tree Cafe team, the rejection points to date formatting. We are confirming the accepted template format and will send exact correction steps shortly.

### Priority and justification

- **Priority:** P3
- **Why:** This is a customer template-format issue with a clear workaround. It does not indicate platform failure or broad production impact.
- **SLA deadlines I am working to:** first response by 16:10, resolution/workaround within normal support queue.

### Investigation log

| Time (exercise clock) | What I checked / did | What I found |
|---|---|---|
| 12:25 | Checked rejection details. | All 4 invoices rejected by portal validation with AE-BR-04. |
| 12:30 | Compared workbook values with template field guide. | Dates used `13/11/2026`; guide requires `YYYY-MM-DD` text or real Excel date cells. |
| 12:35 | Checked validation code. | Date parser rejects unsupported date text and returns AE-BR-04. |

### Root cause

- **What happened:** The workbook used `DD/MM/YYYY` date text.
- **Where:** `docs/template-field-guide.md`; `services/api/internal/validate/validate.go`.
- **Why it happens:** The template parser accepts `YYYY-MM-DD` text or real Excel date cells, not `13/11/2026` text.
- **Evidence:** [evidence/incident-05-ghaf-date-format.md](evidence/incident-05-ghaf-date-format.md)
- **Confidence and open questions:** High confidence. No engineering open question.

### Customer resolution reply OR escalation note

- **Which one and why:** Customer resolution reply. This is documented behavior with a direct workaround.

> Hi Ghaf Tree Cafe team, the invoices were rejected because the date cells use `13/11/2026`. Please change invoice issue date and due date values to `2026-11-13`, or enter them as real Excel date cells rather than text. After saving the corrected workbook, you can re-upload it. No engineering action is required for this one.

### Workaround offered

Use `2026-11-13` for both issue date and due date fields, or use actual Excel date cells.

### Prevention ideas

Improve template validation copy by showing an example accepted date next to AE-BR-04 and consider pre-upload linting in the UI.

---

## Overall

### Prioritisation

I started with the API restart alert because it could affect multiple customers and core upload availability. Oasis came next because it had a large customer, month-end urgency, and duplicate risk, and it also overlapped with the restart behavior. Sahara and Al Noor were both P2; I prioritized Sahara first after seeing buyer delivery was incomplete and duplicate re-upload risk was high. Ghaf was last because it was clearly bounded to customer data format and had a fast workaround.

I did change my mental model while investigating. Oasis first looked like only a slow large file, but reproducing a retry showed it could leave an import stuck after an API restart. Sahara first looked like buyer-side delay, but the missing ASP references plus 429 logs made it an API retry bug.

### What I would do differently

With production access I would first pull exact incident-window metrics: API RSS, restart reasons, request duration percentiles, ASP 429 rate, and counts of invoices stuck by status age. I would also create a small admin-safe "requeue stuck invoice" runbook so support is not tempted to ask customers to re-upload full batches.

### What I learned / what I would need to learn

I got up to speed by reading architecture, SLA/status docs, then mapping each symptom to database state, logs, and code paths. The main concepts were Peppol/ASP delivery states, PINT totals, duplicate detection, and support-safe communication. I would study the exact production ASP retry/idempotency guarantees next, because safe repair depends on knowing whether a message may already have been accepted.

### Time log (real time)

| Date | From-to | What I worked on |
|---|---|---|
| 2026-11-13 | ~22:40-23:15 IST | Read assignment docs, repo docs, inbox, SLA, lifecycle, and architecture. |
| 2026-11-13 | ~23:15-00:20 IST | Started Docker stack, replayed load, inspected logs/container restarts/database state. |
| 2026-11-14 | ~00:20-01:20 IST | Investigated root causes in code and recalculated workbook totals. |
| 2026-11-14 | ~01:20-02:00 IST | Wrote evidence files, customer replies, escalations, and final submission. |

### AI usage disclosure

Used OpenAI Codex as a coding/support assistant to read files, run commands, inspect logs and SQL output, compare code paths, and draft the submission. I checked the conclusions against the running Docker environment, database query results, log excerpts, workbook recalculation, and source code references.
