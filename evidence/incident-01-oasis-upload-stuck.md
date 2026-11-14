# Incident 01 - Oasis Builders upload stuck

## Customer report

- Received: Monday 16 Nov 2026, 09:05 GST.
- Customer: Oasis Builders Supply LLC.
- File: `oasis-builders-nov-2026.xlsx`.
- Symptom: large spreadsheet stays "Processing"; repeated browser attempts eventually show an error page. Customer is worried about duplicate invoices.

## Runtime evidence

Initial replay completed but was slow:

```text
oasis HTTP 201 in 121.7s import=ff8ae1cb-5c64-4c0a-a43a-793a01eb688c status=Completed invoices=8
oasis invoices: Accepted 8
```

Database state after replay and a manual re-upload:

```text
Oasis Builders Supply LLC | 9661aa5a-c189-48aa-94c2-93a6d14b97a1 | oasis-builders-nov-2026.xlsx | Processing | 0   | 0 | null   | 2026-11-13 18:13:09+00 | null
Oasis Builders Supply LLC | ff8ae1cb-5c64-4c0a-a43a-793a01eb688c | oasis-builders-nov-2026.xlsx | Completed  | 600 | 8 | 121682 | 2026-11-13 18:08:45+00 | 2026-11-13 18:10:47+00
```

Manual re-upload from host:

```text
curl: (52) Empty reply from server
HTTP 000 time 0.881806
```

API container state immediately after the manual re-upload:

```text
RestartCount=3
Status=running
OOMKilled=false
ExitCode=0
StartedAt=2026-11-13T18:13:10.505909043Z
```

API log shape:

```text
import received ... import_id=ff8ae1cb... seller_id=2 filename=oasis-builders-nov-2026.xlsx
import parsed ... import_id=ff8ae1cb... rows=600
import completed ... import_id=ff8ae1cb... invoices=8 duration_ms=121682
import received ... import_id=9661aa5a... seller_id=2 filename=oasis-builders-nov-2026.xlsx
api starting ...
```

The later import has a receive log but no parse or completion log.

## Code evidence

- `services/api/internal/httpapi/httpapi.go`: upload handler reads the entire file into memory with `io.ReadAll` and processes the import synchronously.
- `services/api/internal/importer/importer.go`: validation runs across row groups in request path.
- `services/api/internal/importer/sources.go`: `SourceCache` stores raw file bytes, workbook, and parsed invoices in an unbounded process-local map.
- `services/api/internal/importer/importer.go`: duplicate protection excludes the current import but blocks future imports with invoice numbers already accepted or submitted.

## Assessment

The first valid Oasis upload completed, but took about 122 seconds. The workbook has 600 rows for only 8 invoices, and the importer/validator is doing expensive validation work synchronously. A subsequent manual upload hit an API restart and left a new import stuck in `Processing` with 0 rows.

Customer-facing guidance: do not re-upload again; 8 invoices from the completed import are already accepted. Engineering/data repair should cancel or mark the stuck `9661aa5a...` import failed, then confirm no duplicate invoice submission occurred.
