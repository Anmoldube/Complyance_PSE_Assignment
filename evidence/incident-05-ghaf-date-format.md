# Incident 05 - Ghaf Tree Cafe date validation

## Customer report

- Received: Monday 16 Nov 2026, 12:10 GST.
- Customer: Ghaf Tree Cafe.
- Symptom: all invoices rejected for date value `13/11/2026`; customer asks for a quick workaround.

## Runtime evidence

Replay:

```text
ghaf HTTP 201 in 1.7s import=db26477e... status=Completed invoices=4
ghaf invoices: Rejected 4
```

Database:

```text
GTC-118-GD2L | Rejected | portal | AE-BR-04 Invoice issue date* must be a date in YYYY-MM-DD format (got '13/11/2026')
GTC-119-GD2L | Rejected | portal | AE-BR-04 Invoice issue date* must be a date in YYYY-MM-DD format (got '13/11/2026')
GTC-120-GD2L | Rejected | portal | AE-BR-04 Invoice issue date* must be a date in YYYY-MM-DD format (got '13/11/2026')
GTC-121-GD2L | Rejected | portal | AE-BR-04 Invoice issue date* must be a date in YYYY-MM-DD format (got '13/11/2026')
```

The same validation also applies to due dates in the file.

## Code and documentation evidence

- `docs/template-field-guide.md`: date fields must be entered as `YYYY-MM-DD` text or as real Excel date cells.
- `services/api/internal/validate/validate.go`: date validation calls the sheet date parser and returns AE-BR-04 for invalid date format.

## Assessment

This is not a platform defect. The uploaded workbook uses `DD/MM/YYYY`, which the template guide does not support.

Customer workaround: change issue and due date cells to `2026-11-13` or use real Excel date cells formatted from an actual date value, then re-upload.
