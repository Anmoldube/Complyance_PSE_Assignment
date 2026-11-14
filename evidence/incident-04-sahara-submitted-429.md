# Incident 04 - Sahara messages not received by buyer

## Customer report

- Received: Monday 16 Nov 2026, 11:30 GST.
- Customer: Sahara Medical Supplies.
- Symptom: 40 invoices submitted, buyer confirms only a few arrived. Many invoices have no ASP reference.

## Runtime evidence

Replay:

```text
sahara HTTP 201 in 12.3s import=62e49c47-3922-40d7-a003-7cc5148d7fc5 status=Completed invoices=40
sahara invoices: Submitted 32, Accepted 8
```

Database:

```text
SMS-1116-001-GD2L through SMS-1116-008-GD2L | Accepted  | asp_message_id populated
SMS-1116-009-GD2L through SMS-1116-040-GD2L | Submitted | asp_message_id empty
```

API/ASP logs:

```text
asp response ... status_code=429
rate limit exceeded ... retry_after_s=1
```

## Code evidence

- `services/asp-mock/main.go`: ASP mock has a sender fair-use limiter and returns HTTP 429 with `Retry-After`.
- `services/api/internal/submit/submit.go`: submitter handles:
  - 200 as accepted
  - 422 as rejected
  - 500/502/503/504 as failed retryable
  - no explicit 429 path

When the ASP returns 429, the invoice remains `Submitted` with no ASP message ID and no retry marker.

## Assessment

The buyer received only the first 8 invoices because the sender hit the ASP rate limit. The remaining 32 invoices were left in `Submitted` even though the ASP did not accept them.

Immediate action: tell Sahara not to re-upload the whole batch. Confirm the 8 accepted invoices with ASP references, then have engineering requeue or mark/retry the 32 stuck submitted invoices after adding a safe retry path.
