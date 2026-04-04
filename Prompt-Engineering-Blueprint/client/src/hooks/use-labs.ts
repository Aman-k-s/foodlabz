import { useQuery } from "@tanstack/react-query";

export type LabDirectoryItem = {
  labId: string;
  laboratoryName: string;
  certNo: string;
  labType: string;
  issueDate: Date | null;
  validTill: Date | null;
  city: string;
  state: string;
  address: string;
};

type DjangoLabItem = {
  lab_id?: string;
  laboratory_name?: string | null;
  lab_name?: string | null;
  cert_no?: string | null;
  certificate_no?: string | null;
  labtype?: string | null;
  lab_type?: string | null;
  issue_date?: string | null;
  to_date?: string | null;
  valid_till?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  prime_address?: string | null;
};

type DjangoLabsEnvelope = {
  success: boolean;
  data: DjangoLabItem[];
  count?: number;
  total?: number;
  page?: number;
  page_size?: number;
};

const DJANGO_API_BASE = (
  import.meta.env.VITE_DJANGO_API_BASE || import.meta.env.VITE_BACKEND_URL || ""
).replace(/\/$/, "");

function djangoUrl(path: string): string {
  return DJANGO_API_BASE ? `${DJANGO_API_BASE}${path}` : path;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeLab(item: DjangoLabItem): LabDirectoryItem {
  const laboratoryName = (item.laboratory_name || item.lab_name || "").trim();
  const certNo = (item.cert_no || item.certificate_no || "").trim();
  const labType = (item.labtype || item.lab_type || "").trim();
  const address = (item.address || item.prime_address || "").trim();
  return {
    labId: item.lab_id || certNo || laboratoryName,
    laboratoryName,
    certNo,
    labType,
    issueDate: parseDate(item.issue_date),
    validTill: parseDate(item.valid_till || item.to_date),
    city: item.city || "",
    state: item.state || "",
    address,
  };
}

export function useLabsDirectory(
  search: string,
  page: number,
  pageSize: number,
  filters?: { labType?: string; state?: string; city?: string },
) {
  return useQuery({
    queryKey: ["labs-directory", search, page, pageSize, filters?.labType, filters?.state, filters?.city],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filters?.labType) params.set("labtype", filters.labType);
      if (filters?.state) params.set("state", filters.state);
      if (filters?.city) params.set("city", filters.city);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      const res = await fetch(djangoUrl(`/api/labs/?${params.toString()}`));
      if (!res.ok) throw new Error("Failed to fetch lab directory");
      const body = (await res.json()) as DjangoLabsEnvelope;
      const total = body.count ?? body.total ?? body.data.length;
      return {
        items: body.data.map(normalizeLab),
        count: total,
        page: body.page ?? page,
        pageSize: body.page_size ?? pageSize,
      };
    },
  });
}
