import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useLabsDirectory } from "@/hooks/use-certificates";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export default function LabsDirectoryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useLabsDirectory(query, page, 25);

  const labs = data?.data || [];
  const total = data?.total || 0;
  const pageSize = data?.page_size || 25;
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 rounded-3xl border border-white/80 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-navy font-display">All Labs Directory</h2>
              <p className="text-sm text-muted-foreground">Search across labs loaded from file1.xlsx.</p>
            </div>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search lab, cert, city, state..."
                className="w-full rounded-xl border border-border bg-white/80 py-2.5 pl-9 pr-3 text-sm text-navy focus:border-trust focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Lab Name</th>
                  <th className="py-2 px-3">Certificate No</th>
                  <th className="py-2 px-3">ULR</th>
                  <th className="py-2 px-3">Lab Type</th>
                  <th className="py-2 px-3">Valid Till</th>
                  <th className="py-2 px-3">City/State</th>
                  <th className="py-2 px-3">Address</th>
                </tr>
              </thead>
              <tbody className="text-navy">
                {isLoading && (
                  <tr>
                    <td className="py-4 px-3 text-muted-foreground" colSpan={7}>
                      Loading labs...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="py-4 px-3 text-critical" colSpan={7}>
                      Failed to load labs. Check backend API.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && labs.length === 0 && (
                  <tr>
                    <td className="py-4 px-3 text-muted-foreground" colSpan={7}>
                      No labs found for this search.
                    </td>
                  </tr>
                )}
                {labs.map((lab) => {
                  const validTill = lab.extend_date || lab.to_date || "N/A";
                  const cityState = [lab.city, lab.state].filter(Boolean).join(", ") || "N/A";
                  return (
                    <tr key={`${lab.cert_no}-${lab.lab_name}`} className="border-t border-border/60">
                      <td className="py-3 px-3 font-medium">{lab.lab_name}</td>
                      <td className="py-3 px-3 font-mono">{lab.cert_no}</td>
                      <td className="py-3 px-3 font-mono">{lab.ulr_number || "N/A"}</td>
                      <td className="py-3 px-3">{lab.labtype}</td>
                      <td className="py-3 px-3 font-mono">{validTill}</td>
                      <td className="py-3 px-3">{cityState}</td>
                      <td className="py-3 px-3">{lab.prime_address || "N/A"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 text-xs text-muted-foreground md:flex-row md:items-center">
            <span>
              Showing {labs.length} of {total} labs
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canPrev}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                  canPrev ? "border-border text-navy hover:bg-slate-100" : "border-border/40 text-muted-foreground"
                }`}
              >
                Prev
              </button>
              <span className="text-xs">Page {page}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!canNext}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                  canNext ? "border-border text-navy hover:bg-slate-100" : "border-border/40 text-muted-foreground"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
