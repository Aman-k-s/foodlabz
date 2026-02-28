import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CertificateResponse } from "@shared/schema";

type DjangoReportData = {
  lab_name: string | null;
  labtype: string | null;
  certificate_no: string | null;
  ulr_number: string | null;
  status: string | null;
  issue_date: string | null;
  valid_till: string | null;
};

type DjangoEnvelope = {
  success: boolean;
  data: DjangoReportData;
};

const DJANGO_API_BASE = (
  import.meta.env.VITE_DJANGO_API_BASE ||
  import.meta.env.VITE_BACKEND_URL ||
  ""
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
): CertificateResponse {
  const ulr = payload.ulr_number || fallbackUlr || "";
  const dateIssued = parseDate(payload.issue_date) || new Date();
  const validTill = parseDate(payload.valid_till);
  const status = payload.status || "INVALID_CERTIFICATE";
  const isValid = status === "VALID";

  return {
    id: 0,
    ulr,
    labName: payload.lab_name || "Unknown Laboratory",
    labType: payload.labtype || "N/A",
    certificateNo: payload.certificate_no || "N/A",
    address: "Address not found in registry",
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
    },
  });
}

export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

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
          // Fall through with default message.
        }
        throw new Error(message);
      }

      const body = (await res.json()) as DjangoEnvelope;
      return normalizeToCertificate(body.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.certificates.getByUlr.path, data.ulr], data);
    },
  });
}
