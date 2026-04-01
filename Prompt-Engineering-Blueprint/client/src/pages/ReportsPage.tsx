import { useMemo, useState } from "react";
import { format } from "date-fns";
import { FileText, Search } from "lucide-react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useReportsTable } from "@/hooks/use-certificates";

const PAGE_SIZE = 25;

function formatDate(value: Date | null, fallback = "N/A") {
  if (!value) return fallback;
  try {
    return format(value, "yyyy-MM-dd HH:mm");
  } catch {
    return fallback;
  }
}

function statusClass(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "VALID":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useReportsTable(search, statusFilter, page, PAGE_SIZE);

  const totalPages = useMemo(() => {
    if (!data?.count) return 1;
    return Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  }, [data?.count]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 flex flex-col relative overflow-hidden">
      <div className="absolute top-[-12%] right-[-6%] w-[520px] h-[520px] bg-trust/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-12%] left-[-6%] w-[620px] h-[620px] bg-success/20 rounded-full blur-3xl"></div>
      <div className="absolute top-[30%] left-[35%] w-[360px] h-[360px] bg-warning/20 rounded-full blur-3xl"></div>
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        <div className="bg-white/60 backdrop-blur-2xl border border-white/70 rounded-2xl shadow-2xl shadow-cyan-500/20 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-navy font-display flex items-center gap-2">
                <FileText className="w-5 h-5 text-trust" />
                Uploaded Reports
              </h1>
              <p className="text-sm text-muted-foreground">
                Review uploaded reports in the app without opening Django admin.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search vendor, ULR, lab, commodity..."
                  className="w-full sm:w-72 bg-white/80 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-44 bg-white/80 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
              >
                <option value="">All statuses</option>
                <option value="VALID">VALID</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-white/70 bg-white/70">
            <table className="w-full text-left text-sm min-w-[1250px]">
              <thead className="bg-white/80 text-muted-foreground uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Vendor ID</th>
                  <th className="px-4 py-3">Vendor Name</th>
                  <th className="px-4 py-3">Consignment ID</th>
                  <th className="px-4 py-3">Commodity</th>
                  <th className="px-4 py-3">Lab Name</th>
                  <th className="px-4 py-3">Accreditation No</th>
                  <th className="px-4 py-3">ULR Number</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={11}>
                      Loading uploaded reports...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="px-4 py-6 text-center text-critical font-medium" colSpan={11}>
                      Unable to load reports. Please try again.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && data?.items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={11}>
                      No reports found for this search.
                    </td>
                  </tr>
                )}
                {data?.items.map((report) => (
                  <tr key={report.reportId || `${report.ulr}-${report.createdAt?.toISOString()}`} className="hover:bg-white/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-navy">{report.reportId || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{report.vendorId || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{report.vendorName || report.vendor || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{report.consignmentId || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{report.commodity || "N/A"}</td>
                    <td className="px-4 py-3 text-navy max-w-[220px]">
                      <div className="line-clamp-3">{report.labName || "N/A"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-navy">{report.certificateNo || "N/A"}</td>
                    <td className="px-4 py-3 font-mono text-navy">{report.ulr || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(report.status)}`}>
                        {report.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy whitespace-nowrap">{formatDate(report.createdAt ?? null)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {report.ulr ? (
                          <Link
                            href={`/dashboard/${encodeURIComponent(report.ulr)}`}
                            className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
                          >
                            View Details
                          </Link>
                        ) : null}
                        {report.fileUrl ? (
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-lg bg-trust px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy"
                          >
                            Open PDF
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm">
            <p className="text-muted-foreground">
              Showing page {data?.page || page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-navy text-sm font-semibold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-navy text-sm font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
