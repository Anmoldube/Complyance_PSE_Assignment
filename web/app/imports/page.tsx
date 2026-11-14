import Link from 'next/link';
import AutoRefresh from '@/components/AutoRefresh';
import ErrorPanel from '@/components/ErrorPanel';
import StatusBadge from '@/components/StatusBadge';
import { apiGet, load } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import { INVOICE_STATUSES, type ImportPage } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZES = [10, 25, 50];

type ImportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageHref(page: number, pageSize: number): string {
  return `/imports?page=${page}&pageSize=${pageSize}`;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const params = (await searchParams) ?? {};
  const page = positiveInt(firstParam(params.page), 1);
  const requestedPageSize = positiveInt(firstParam(params.pageSize), 25);
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 25;
  const { data, error } = await load(() => apiGet<ImportPage>(`/imports?page=${page}&pageSize=${pageSize}`));
  const imports = data?.items ?? [];
  const currentPage = data?.page ?? page;
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <>
      <AutoRefresh />
      <div className="page-head">
        <h1>Batches</h1>
        <Link className="button" href="/upload">
          Upload file
        </Link>
      </div>
      {error ? (
        <ErrorPanel message={error} />
      ) : imports.length === 0 ? (
        <div className="card muted">No uploads yet.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Uploaded at (GST)</th>
                <th>Company</th>
                <th>File</th>
                <th>Batch status</th>
                <th className="num">Rows</th>
                <th className="num">Invoices</th>
                <th>Invoice statuses</th>
                <th className="num">Processing time</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td className="nowrap">
                    <Link href={`/imports/${imp.id}`}>{formatDateTime(imp.createdAt)}</Link>
                  </td>
                  <td>{imp.sellerName}</td>
                  <td>
                    <Link href={`/imports/${imp.id}`}>{imp.filename}</Link>
                  </td>
                  <td>
                    <StatusBadge status={imp.status} />
                  </td>
                  <td className="num">{imp.rowCount}</td>
                  <td className="num">{imp.invoiceCount}</td>
                  <td className="chips">
                    {INVOICE_STATUSES.filter((s) => imp.statusCounts[s] > 0).map((s) => (
                      <StatusBadge key={s} status={s} count={imp.statusCounts[s]} />
                    ))}
                  </td>
                  <td className="num">{formatDuration(imp.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <div className="muted">
              Showing {start}-{end} of {total} batches
            </div>
            <div className="page-size" aria-label="Rows per page">
              {PAGE_SIZES.map((size) => (
                <Link
                  key={size}
                  className={size === pageSize ? 'page-size-option active' : 'page-size-option'}
                  href={pageHref(1, size)}
                >
                  {size}
                </Link>
              ))}
            </div>
            <div className="pagination" aria-label="Pagination">
              {currentPage > 1 ? (
                <Link className="button secondary" href={pageHref(currentPage - 1, pageSize)}>
                  Previous
                </Link>
              ) : (
                <span className="button secondary disabled">Previous</span>
              )}
              <span className="muted">
                Page {currentPage} of {totalPages || 1}
              </span>
              {totalPages > 0 && currentPage < totalPages ? (
                <Link className="button secondary" href={pageHref(currentPage + 1, pageSize)}>
                  Next
                </Link>
              ) : (
                <span className="button secondary disabled">Next</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
