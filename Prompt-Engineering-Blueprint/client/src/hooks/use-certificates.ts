import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CertificateResponse } from "@shared/schema";

export type UiCertificate = CertificateResponse & {
  fileUrl?: string;
  createdAt?: Date | null;
  rejectionReason?: string | null;
  vendor?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  consignmentId?: string | null;
  commodity?: string | null;
};

type DjangoReportData = {
  vendor?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  consignment_id?: string | null;
  commodity?: string | null;
  lab_name: string | null;
  labtype: string | null;
  certificate_no: string | null;
  ulr_number: string | null;
  status: string | null;
  rejection_reason?: string | null;
  issue_date: string | null;
  to_date: string | null;
  valid_till: string | null;
  address: string | null;
  file_url: string | null;
  created_at?: string | null;
};

type DjangoEnvelope = {
  success: boolean;
  data: DjangoReportData;
};

type DjangoListEnvelope = {
  success: boolean;
  data: DjangoReportData[];
};

export type LabDirectoryItem = {
  lab_name: string;
  cert_no: string;
  ulr_number: string | null;
  labtype: string;
  issue_date: string | null;
  to_date: string | null;
  extend_date: string | null;
  city: string | null;
  state: string | null;
  prime_address: string | null;
};

type LabsDirectoryEnvelope = {
  success: boolean;
  total: number;
  page: number;
  page_size: number;
  data: LabDirectoryItem[];
};

const DJANGO_API_BASE = (
  import.meta.env.PROD
    ? ""
    : import.meta.env.VITE_DJANGO_API_BASE || import.meta.env.VITE_BACKEND_URL || ""
).replace(/\/$/, "");

function djangoUrl(path: string): string {
  return DJANGO_API_BASE ? `${DJANGO_API_BASE}${path}` : path;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = trimmed.match(ddmmyyyy);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeToCertificate(
  payload: DjangoReportData,
  fallbackUlr?: string,
): UiCertificate {
  const ulr = payload.ulr_number || fallbackUlr || "";
  const dateIssued = parseDate(payload.issue_date) || new Date();
  const validTill = parseDate(payload.valid_till);
  const status = payload.status || "INVALID_CERTIFICATE";
  const isValid = status === "VALID";

  return {
    id: 0,
    ulr,
    vendor: payload.vendor || null,
    vendorId: payload.vendor_id || null,
    vendorName: payload.vendor_name || payload.vendor || null,
    consignmentId: payload.consignment_id || null,
    commodity: payload.commodity || null,
    labName: payload.lab_name || "Unknown Laboratory",
    labType: payload.labtype || "N/A",
    certificateNo: payload.certificate_no || "N/A",
    address: payload.address || "Address not found in registry",
    dateIssued,
    validTill,
    status,
    isVerified: isValid,
    signatureValid: isValid,
    scopeValid: isValid,
    licenseExpiry: validTill,
    testParameters: [],
    auditLogs: [],
    chromatograms: [],
    fileUrl: payload.file_url || "",
    createdAt: parseDate(payload.created_at || "") || null,
    rejectionReason: payload.rejection_reason || null,
  };
}

export function useCertificates() {
  return useQuery({
    queryKey: [api.certificates.list.path],
    queryFn: async () => {
      const res = await fetch(api.certificates.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch certificates");
      return res.json() as Promise<CertificateResponse[]>;
    },
  });
}

export function useCertificate(id: number) {
  return useQuery({
    queryKey: [api.certificates.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.certificates.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch certificate");
      return res.json() as Promise<CertificateResponse>;
    },
    enabled: !!id,
  });
}

export function useCertificateByUlr(ulr: string) {
  return useQuery({
    queryKey: [api.certificates.getByUlr.path, ulr],
    queryFn: async () => {
      const res = await fetch(djangoUrl(`/api/report/${encodeURIComponent(ulr)}/`));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch certificate by ULR");
      const body = (await res.json()) as DjangoEnvelope;
      return normalizeToCertificate(body.data, ulr);
    },
    enabled: !!ulr && ulr.length > 5,
    retry: false,
  });
}

export function useUploadedReports() {
  return useQuery({
    queryKey: ["django-uploaded-reports"],
    queryFn: async () => {
      const res = await fetch(djangoUrl("/api/reports/"));
      if (!res.ok) throw new Error("Failed to fetch uploaded reports");
      const body = (await res.json()) as DjangoListEnvelope;
      return body.data.map((item) => normalizeToCertificate(item));
    },
    retry: false,
  });
}

export function useLabsDirectory(
  query: string,
  page: number,
  pageSize = 25,
  filters?: { labtype?: string; state?: string; city?: string }
) {
  return useQuery({
    queryKey: ["labs-directory", query, page, pageSize, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (filters?.labtype) params.set("labtype", filters.labtype);
      if (filters?.state) params.set("state", filters.state);
      if (filters?.city) params.set("city", filters.city);
      const res = await fetch(djangoUrl(`/api/labs/?${params.toString()}`));
      if (!res.ok) throw new Error("Failed to fetch labs directory");
      return (await res.json()) as LabsDirectoryEnvelope;
    },
    retry: false,
  });
}

export function useVerifyCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ulr: string) => {
      const res = await fetch(djangoUrl(`/api/report/${encodeURIComponent(ulr)}/`));
      if (!res.ok) {
        let message = "Verification failed";
        try {
          const errorData = await res.json();
          message = errorData.message || message;
        } catch {
          // Fall through with default message.
        }
        throw new Error(message);
      }
      const body = (await res.json()) as DjangoEnvelope;
      return normalizeToCertificate(body.data, ulr);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.certificates.getByUlr.path, data.ulr], data);
      queryClient.invalidateQueries({ queryKey: ["django-uploaded-reports"] });
    },
  });
}

export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      vendorId,
      vendorName,
      consignmentId,
      commodity,
    }: {
      file: File;
      vendorId: string;
      vendorName: string;
      consignmentId: string;
      commodity: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vendor_id", vendorId);
      formData.append("vendor_name", vendorName);
      formData.append("consignment_id", consignmentId);
      formData.append("commodity", commodity);

      const res = await fetch(djangoUrl("/api/upload/"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "Upload failed";
        try {
          const errorData = await res.json();
          message = errorData.error || errorData.message || message;
        } catch {
          try {
            const text = await res.text();
            if (text) {
              message = text.slice(0, 180);
            }
          } catch {
            // Fall through with default message.
          }
        }
        if (message === "Upload failed") {
          if (res.status === 502 || res.status === 504) {
            message = "Upload timed out at server. Try a smaller/clearer PDF.";
          } else {
            message = `Upload failed (${res.status})`;
          }
        }
        throw new Error(message);
      }

      const body = (await res.json()) as DjangoEnvelope;
      return normalizeToCertificate(body.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.certificates.getByUlr.path, data.ulr], data);
      queryClient.invalidateQueries({ queryKey: ["django-uploaded-reports"] });
    },
  });
}

export function useClearUploadedReports() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(djangoUrl("/api/reports/clear/"), {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to clear demo reports.");
      }
      return res.json() as Promise<{ success: boolean; cleared: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["django-uploaded-reports"] });
      queryClient.removeQueries({ queryKey: [api.certificates.getByUlr.path] });
    },
  });
}
