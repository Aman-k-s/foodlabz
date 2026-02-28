import { z } from 'zod';
import { certificates, testParameters, auditLogs, chromatograms } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  certificates: {
    list: {
      method: 'GET' as const,
      path: '/api/certificates' as const,
      responses: {
        200: z.array(z.custom<typeof certificates.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/certificates/:id' as const,
      responses: {
        200: z.custom<any>(), // CertificateResponse
        404: errorSchemas.notFound,
      },
    },
    getByUlr: {
      method: 'GET' as const,
      path: '/api/certificates/ulr/:ulr' as const,
      responses: {
        200: z.custom<any>(), // CertificateResponse
        404: errorSchemas.notFound,
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/certificates/verify' as const,
      input: z.object({ ulr: z.string() }),
      responses: {
        200: z.custom<any>(), // CertificateResponse
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/certificates/upload' as const,
      responses: {
        200: z.custom<any>(), // CertificateResponse
        400: errorSchemas.validation,
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
