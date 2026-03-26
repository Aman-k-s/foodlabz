import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Navbar } from "@/components/layout/Navbar";
import { useLabsDirectory } from "@/hooks/use-labs";
import { Building2, MapPinned, Search } from "lucide-react";

const PAGE_SIZE = 50;

function formatDate(value: Date | null, fallback = "N/A") {
  if (!value) return fallback;
  try {
    return format(value, "yyyy-MM-dd");
  } catch {
    return fallback;
  }
}

export default function LabsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [labTypeFilter, setLabTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const { data, isLoading, isError } = useLabsDirectory(search.trim(), page, PAGE_SIZE, {
    labType: labTypeFilter.trim(),
    state: stateFilter.trim(),
    city: cityFilter.trim(),
  });

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
                <Building2 className="w-5 h-5 text-trust" />
                All Labs Directory
              </h1>
              <p className="text-sm text-muted-foreground">
                Search across all labs loaded from the registry dataset.
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
                  placeholder="Search lab, certificate, city, state..."
                  className="w-full sm:w-72 bg-white/80 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={labTypeFilter}
                  onChange={(e) => {
                    setLabTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter lab type"
                  className="w-full sm:w-40 bg-white/80 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
                />
                <input
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter state"
                  className="w-full sm:w-40 bg-white/80 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
                />
                <input
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter city"
                  className="w-full sm:w-40 bg-white/80 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trust/30"
                />
              </div>
              <Link
                href="/labs/map/all"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-trust text-white text-sm font-semibold hover:bg-navy transition-colors shadow-lg shadow-trust/30"
              >
                <MapPinned className="w-4 h-4" />
                View Labs Map
              </Link>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-white/70 bg-white/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/80 text-muted-foreground uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3">Lab Name</th>
                  <th className="px-4 py-3">Certificate No</th>
                  <th className="px-4 py-3">Lab Type</th>
                  <th className="px-4 py-3">Valid Till</th>
                  <th className="px-4 py-3">City / State</th>
                  <th className="px-4 py-3">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                      Loading labs directory...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="px-4 py-6 text-center text-critical font-medium" colSpan={6}>
                      Unable to load lab directory. Please try again.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && data?.items?.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                      No labs found for this search.
                    </td>
                  </tr>
                )}
                {data?.items?.map((lab) => (
                  <tr key={lab.labId} className="hover:bg-white/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-navy">{lab.laboratoryName || "N/A"}</td>
                    <td className="px-4 py-3 font-mono text-navy">{lab.certNo || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{lab.labType || "N/A"}</td>
                    <td className="px-4 py-3 text-navy">{formatDate(lab.validTill)}</td>
                    <td className="px-4 py-3 text-navy">
                      {[lab.city, lab.state].filter(Boolean).join(", ") || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-navy text-xs leading-relaxed">
                      {lab.address || "N/A"}
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
