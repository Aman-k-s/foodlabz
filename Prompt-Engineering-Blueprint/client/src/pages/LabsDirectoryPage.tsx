import { useDeferredValue, useEffect, useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { ArrowLeft, Search } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLabsDirectory } from "@/hooks/use-certificates";

function formatValidityDate(value: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd/MM/yyyy");
}

export default function LabsDirectoryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const pageSize = 50;
  const { data, isLoading, isError, isFetching } = useLabsDirectory(deferredQuery, page, pageSize);
  const labs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-slate-50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-navy font-display">All Labs</h2>
              <p className="text-sm text-muted-foreground mt-1">
                View the lab list from the attached Excel file.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-navy font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Search
            </Link>
          </div>

          <div className="p-6 border-b border-border">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by lab name, certificate number, type, commodity, city, or state"
                className="w-full rounded-xl border border-border bg-slate-50 pl-11 pr-4 py-3 text-sm text-navy focus:outline-none focus:border-trust focus:ring-4 focus:ring-trust/10"
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Total labs: <span className="font-semibold text-navy">{total}</span>
              {" "} | {" "}
              Page: <span className="font-semibold text-navy">{page}</span> of <span className="font-semibold text-navy">{totalPages}</span>
              {isFetching ? <span className="ml-2">Updating...</span> : null}
            </p>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading labs list...
              </div>
            ) : isError ? (
              <div className="py-12 text-center text-sm text-critical">
                Could not load the labs list from backend.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Lab Name</TableHead>
                    <TableHead>Certificate No.</TableHead>
                    <TableHead>Valid Till</TableHead>
                    <TableHead>Lab Type</TableHead>
                    <TableHead>District / State</TableHead>
                    <TableHead>Commodity / Segment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        No labs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    labs.map((lab) => (
                      <TableRow key={`${lab.certificateNo}-${lab.name}`}>
                        <TableCell>
                          <div className="font-medium text-navy">{lab.name}</div>
                        </TableCell>
                        <TableCell className="font-mono">{lab.certificateNo}</TableCell>
                        <TableCell>{formatValidityDate(lab.validityDate)}</TableCell>
                        <TableCell>{lab.labType}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {[lab.district, lab.state].filter(Boolean).join(", ") || "Location unavailable"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{lab.commodityOrSegment}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {!isLoading && !isError ? (
            <div className="px-6 pb-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-slate-100 text-navy font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Showing {labs.length === 0 ? 0 : (page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, total)} of {total}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg bg-slate-100 text-navy font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
