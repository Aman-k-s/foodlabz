import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useLabsDirectory } from "@/hooks/use-certificates";
import { MapPin, ArrowLeft, ExternalLink } from "lucide-react";
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

type LabDirectoryItem = {
  lab_name: string;
  cert_no: string;
  labtype: string;
  city: string | null;
  state: string | null;
  prime_address: string | null;
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
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }, [map, points]);
  return null;
}

function useQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export default function LabsMapPage() {
  const [location] = useLocation();
  const isAllLabs = location.includes("/labs/map/all");
  const place = useQueryParam("place") || "";

  const { data, isLoading, isError } = useLabsDirectory("", 1, MAX_LABS);
  const labs = data?.data || [];

  const groupedPlaces = useMemo(() => {
    const groups = new Map<string, { label: string; labs: LabDirectoryItem[] }>();
    labs.forEach((lab) => {
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
  }, [labs]);

  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    if (!isAllLabs) return;
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

      for (const [key, placeGroup] of groupedPlaces) {
        if (cancelled) return;

        const cached = loadCache(key);
        if (cached) {
          nextPoints.push({ key, label: placeGroup.label, labs: placeGroup.labs, ...cached });
          continue;
        }

        const coords = await geocodePlace(placeGroup.label);
        if (coords) {
          storeCache(key, coords);
          nextPoints.push({ key, label: placeGroup.label, labs: placeGroup.labs, ...coords });
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
  }, [groupedPlaces, isAllLabs]);

  const mapSrc = useMemo(() => {
    const encoded = encodeURIComponent(place || "India");
    return `https://www.google.com/maps?q=${encoded}&output=embed`;
  }, [place]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="bg-white/70 rounded-3xl border border-white/80 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-navy font-display flex items-center gap-2">
                <MapPin className="h-5 w-5 text-trust" />
                {isAllLabs ? "All Labs Map" : "Lab Location"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Approximate location based on lab details.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/labs"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Labs
              </Link>
              {!isAllLabs && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place || "India")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-trust px-4 py-2 text-sm font-semibold text-white hover:bg-navy"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Maps
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl overflow-hidden border border-border">
            {isAllLabs ? (
              <div className="h-[520px] w-full">
                {(isLoading || isGeocoding) && (
                  <div className="p-4 text-sm text-muted-foreground">
                    {isLoading ? "Loading labs data..." : "Geocoding lab locations..."}
                  </div>
                )}
                {isError && (
                  <div className="p-4 text-sm text-critical">
                    Failed to load labs directory. Please check the backend API.
                  </div>
                )}
                {!isLoading && !isError && points.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    No mappable lab locations found yet.
                  </div>
                )}
                {!!skipped && (
                  <div className="p-4 text-xs text-muted-foreground">
                    {skipped} locations could not be geocoded.
                  </div>
                )}
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
                              <li key={`${lab.cert_no}-${lab.lab_name}`}>
                                {lab.lab_name} ({lab.cert_no})
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
            ) : (
              <iframe
                title="Lab Location Map"
                src={mapSrc}
                className="w-full h-[520px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
          {place && !isAllLabs && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing: {place}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
