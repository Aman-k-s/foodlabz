import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useLabsDirectory, type LabDirectoryItem } from "@/hooks/use-labs";
import { MapPinned, RefreshCcw } from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const MAX_LABS = 200;
const GEO_DELAY_MS = 850;

const defaultMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type GeoPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  labs: LabDirectoryItem[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPlaceLabel(lab: LabDirectoryItem) {
  const label = [lab.city, lab.state].filter(Boolean).join(", ");
  return label.trim();
}

function loadCache(key: string): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(`labz-geo:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number };
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeCache(key: string, value: { lat: number; lng: number }) {
  try {
    localStorage.setItem(`labz-geo:${key}`, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors.
  }
}

function clearCache(keys: string[]) {
  try {
    keys.forEach((key) => localStorage.removeItem(`labz-geo:${key}`));
  } catch {
    // Ignore localStorage errors.
  }
}

async function geocodePlace(label: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", label);

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }, [map, points]);
  return null;
}

export default function LabsMapPage() {
  const { data, isLoading, isError } = useLabsDirectory("", 1, MAX_LABS);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const groupedPlaces = useMemo(() => {
    const groups = new Map<string, { label: string; labs: LabDirectoryItem[] }>();
    data?.items?.forEach((lab) => {
      const label = getPlaceLabel(lab);
      if (!label) return;
      const key = label.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { label, labs: [lab] });
      } else {
        groups.get(key)!.labs.push(lab);
      }
    });
    return groups;
  }, [data?.items]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!groupedPlaces.size) {
        setPoints([]);
        setIsGeocoding(false);
        return;
      }

      setIsGeocoding(true);
      setSkipped(0);
      const nextPoints: GeoPoint[] = [];

      for (const [key, place] of Array.from(groupedPlaces.entries())) {
        if (cancelled) return;

        const cached = loadCache(key);
        if (cached) {
          nextPoints.push({ key, label: place.label, labs: place.labs, ...cached });
          continue;
        }

        const coords = await geocodePlace(place.label);
        if (coords) {
          storeCache(key, coords);
          nextPoints.push({ key, label: place.label, labs: place.labs, ...coords });
        } else {
          setSkipped((prev) => prev + 1);
        }

        await sleep(GEO_DELAY_MS);
      }

      if (!cancelled) {
        setPoints(nextPoints);
        setIsGeocoding(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [groupedPlaces, refreshKey]);

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
                <MapPinned className="w-5 h-5 text-trust" />
                Labs Map View
              </h1>
              <p className="text-sm text-muted-foreground">
                Approximate locations based on city/state. Showing up to {MAX_LABS} labs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/labs"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/80 border border-border text-navy text-sm font-semibold hover:bg-white transition-colors"
              >
                View Lab Details
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearCache(Array.from(groupedPlaces.keys()));
                  setPoints([]);
                  setRefreshKey((prev) => prev + 1);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-trust text-white text-sm font-semibold hover:bg-navy transition-colors shadow-lg shadow-trust/30"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh Map
              </button>
            </div>
          </div>

          <div className="mt-6">
            {(isLoading || isGeocoding) && (
              <div className="mb-3 text-sm text-muted-foreground">
                {isLoading ? "Loading labs data..." : "Geocoding lab locations..."}
              </div>
            )}
            {isError && (
              <div className="mb-3 text-sm text-critical font-medium">
                Unable to load lab locations. Please try again.
              </div>
            )}
            {!isLoading && !isError && points.length === 0 && (
              <div className="mb-3 text-sm text-muted-foreground">
                No mappable lab locations yet. Add city/state data to the registry.
              </div>
            )}
            {!!skipped && (
              <div className="mb-3 text-xs text-muted-foreground">
                {skipped} locations could not be geocoded.
              </div>
            )}

            <div className="h-[70vh] w-full rounded-2xl overflow-hidden border border-white/70 shadow-inner">
              <MapContainer center={[20.5937, 78.9629]} zoom={4} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {points.map((point) => (
                  <Marker key={point.key} position={[point.lat, point.lng]} icon={defaultMarkerIcon}>
                    <Popup>
                      <div className="space-y-1">
                        <p className="font-semibold text-navy">{point.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {point.labs.length} lab{point.labs.length === 1 ? "" : "s"}
                        </p>
                        <ul className="text-xs text-navy space-y-0.5">
                          {point.labs.slice(0, 5).map((lab) => (
                            <li key={lab.labId}>
                              {lab.laboratoryName} ({lab.certNo})
                            </li>
                          ))}
                          {point.labs.length > 5 && <li>+ {point.labs.length - 5} more</li>}
                        </ul>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                <FitBounds points={points} />
              </MapContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
