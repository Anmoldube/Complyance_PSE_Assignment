# Incident 02 - API restarts and Marina Bay 502s

## Customer/support report

- Received: Monday 16 Nov 2026, 09:42 GST alert; 09:50 GST support follow-up.
- Customer impact: Marina Bay reports 502s on upload. Priya reports no invoices moving beyond `Validated` since about 09:30.

## Runtime evidence

Load replay:

```text
peak 240 uploads from 4 customers, 8 at a time
peak 225/240 uploads done (204 ok, 21 failed)
peak finished: 219 ok, 21 failed
peak 15 x Post "http://api:8080/v1/imports": EOF
peak 2 x Post "http://api:8080/v1/imports": dial tcp ... connect: connection
peak 3 x Post "http://api:8080/v1/imports": dial tcp: lookup api on 127.0.0.11:53: no such host
peak 1 x Post "http://api:8080/v1/imports": read tcp ...
summary imports since start: map[Completed:225 Processing:13]
summary invoices: Parsed 15, Validated 67, Submitted 759, Accepted 602, Rejected 7
```

API container after peak:

```text
docker compose ps: api Up 53 seconds while dependent services had been up about 5 minutes
docker inspect: RestartCount=2 Status=running OOMKilled=false ExitCode=0 StartedAt=2026-11-13T18:11:44Z
```

API logs during peak:

```text
api starting ... at 18:07:16
api starting ... at 18:11:18
api starting ... at 18:11:44
```

Recent invoice state included many invoices not moving forward:

```text
Marina Bay Electronics LLC | Parsed    | 3
Marina Bay Electronics LLC | Validated | 15
Marina Bay Electronics LLC | Submitted | 177
Marina Bay Electronics LLC | Accepted  | 147
```

## Code evidence

- `services/api/internal/httpapi/httpapi.go`: upload handler uses `io.ReadAll` and runs imports synchronously inside the request.
- `services/api/internal/importer/sources.go`: unbounded in-memory source cache stores raw bytes, workbook, and invoice slices.
- `docker-compose.yml`: API memory limit is 128 MiB.
- `services/api/internal/submit/submit.go`: submitter handles 200, 422, and selected 5xx statuses, but has no 429 handling path.
- `services/asp-mock/main.go`: ASP fair-use limiter returns 429 with `Retry-After`.

## Assessment

This is a production instability incident. Concurrent uploads pressure the API process enough to restart it, causing client-side EOF/connection failures that surface as 502s. Separately, ASP 429 responses are not handled, so invoices can remain in `Submitted` without message IDs instead of being retried after `Retry-After`.

Immediate action: classify P1, keep on-call engaged, pause unnecessary bulk replays/imports if possible, and provide 30-minute updates. Engineering fix should move uploads to durable async jobs, bound memory/cache, add import recovery on startup, and implement 429 retry/backoff.
