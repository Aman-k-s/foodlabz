import { db } from "./db";
import {
  certificates, testParameters, auditLogs, chromatograms,
  type CertificateResponse, type InsertCertificate, type InsertTestParameter, type InsertAuditLog, type InsertChromatogram
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getCertificates(): Promise<CertificateResponse[]>;
  getCertificate(id: number): Promise<CertificateResponse | undefined>;
  getCertificateByUlr(ulr: string): Promise<CertificateResponse | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<CertificateResponse>;
  createTestParameter(param: InsertTestParameter): Promise<void>;
  createAuditLog(log: InsertAuditLog): Promise<void>;
  createChromatogram(chrom: InsertChromatogram): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCertificates(): Promise<CertificateResponse[]> {
    const certs = await db.query.certificates.findMany({
      with: {
        testParameters: true,
        auditLogs: true,
        chromatograms: true,
      }
    });
    return certs as CertificateResponse[];
  }

  async getCertificate(id: number): Promise<CertificateResponse | undefined> {
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.id, id),
      with: {
        testParameters: true,
        auditLogs: true,
        chromatograms: true,
      }
    });
    return cert as CertificateResponse | undefined;
  }

  async getCertificateByUlr(ulr: string): Promise<CertificateResponse | undefined> {
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.ulr, ulr),
      with: {
        testParameters: true,
        auditLogs: true,
        chromatograms: true,
      }
    });
    return cert as CertificateResponse | undefined;
  }

  async createCertificate(insertCertificate: InsertCertificate): Promise<CertificateResponse> {
    const [cert] = await db.insert(certificates).values(insertCertificate).returning();
    // Return empty relations for a newly created cert
    return { ...cert, testParameters: [], auditLogs: [], chromatograms: [] } as CertificateResponse;
  }

  async createTestParameter(param: InsertTestParameter): Promise<void> {
    await db.insert(testParameters).values(param);
  }

  async createAuditLog(log: InsertAuditLog): Promise<void> {
    await db.insert(auditLogs).values(log);
  }

  async createChromatogram(chrom: InsertChromatogram): Promise<void> {
    await db.insert(chromatograms).values(chrom);
  }
}

export const storage = new DatabaseStorage();
