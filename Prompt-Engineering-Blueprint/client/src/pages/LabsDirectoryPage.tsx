import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useLabsDirectory } from "@/hooks/use-certificates";
import { MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function LabsDirectoryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [labTypeFilter, setLabTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const { data, isLoading, isError } = useLabsDirectory(query, page, 25, {
    labtype: labTypeFilter || undefined,
    state: stateFilter || undefined,
    city: cityFilter || undefined,
  });

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
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-80">
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
              <a
                href="/labs/map/all"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white/80 px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
              >
                <MapPin className="h-4 w-4" />
                View All Labs Map
              </a>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lab Type</label>
              <select
                value={labTypeFilter}
                onChange={(e) => {
                  setLabTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-border bg-white/80 py-2.5 px-3 text-sm text-navy focus:border-trust focus:outline-none"
              >
                <option value="">All</option>
                <option value="Testing">Testing</option>
                <option value="Calibration">Calibration</option>
                <option value="Medical">Medical</option>
                <option value="Chemical">Chemical</option>
                <option value="Biological">Biological</option>
                <option value="Microbiological">Microbiological</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</label>
              <input
                type="text"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Maharashtra"
                className="mt-1 w-full rounded-xl border border-border bg-white/80 py-2.5 px-3 text-sm text-navy focus:border-trust focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Delhi"
                className="mt-1 w-full rounded-xl border border-border bg-white/80 py-2.5 px-3 text-sm text-navy focus:border-trust focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Lab Name</th>
                  <th className="py-2 px-3">Certificate No</th>
                  <th className="py-2 px-3">Lab Type</th>
                  <th className="py-2 px-3">Valid Till</th>
                  <th className="py-2 px-3">City/State</th>
                  <th className="py-2 px-3">Address</th>
                  <th className="py-2 px-3">Map</th>
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
                  const cityState = [lab.city, lab.state].filter(Boolean).join(", ") || "";
                      const mapQuery = encodeURIComponent(
                        [lab.lab_name, lab.prime_address, lab.city, lab.state].filter(Boolean).join(", ")
                      );
                  return (
                    <tr key={`${lab.cert_no}-${lab.lab_name}`} className="border-t border-border/60">
                      <td className="py-3 px-3 font-medium">{lab.lab_name}</td>
                      <td className="py-3 px-3 font-mono">{lab.cert_no}</td>
                      <td className="py-3 px-3">{lab.labtype}</td>
                      <td className="py-3 px-3 font-mono">{validTill}</td>
                      <td className="py-3 px-3">{cityState || "N/A"}</td>
                      <td className="py-3 px-3">{lab.prime_address || "N/A"}</td>
                      <td className="py-3 px-3">
                        <a
                          href={`/labs/map?place=${mapQuery}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-trust hover:text-navy hover:bg-slate-100"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          View Map
                        </a>
                      </td>
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
