import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.certificates.list.path, async (req, res) => {
    const certs = await storage.getCertificates();
    res.json(certs);
  });

  app.get(api.certificates.get.path, async (req, res) => {
    const cert = await storage.getCertificate(Number(req.params.id));
    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    res.json(cert);
  });

  app.get(api.certificates.getByUlr.path, async (req, res) => {
    const cert = await storage.getCertificateByUlr(req.params.ulr);
    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    res.json(cert);
  });

  app.post(api.certificates.verify.path, async (req, res) => {
    try {
      const input = api.certificates.verify.input.parse(req.body);
      const cert = await storage.getCertificateByUlr(input.ulr);
      if (!cert) {
        return res.status(404).json({ message: 'Certificate not found for the provided ULR' });
      }
      
      // Write audit log that verification was accessed
      await storage.createAuditLog({
        certificateId: cert.id,
        action: 'ULR Verification Requested',
        status: 'success'
      });
      
      res.json(cert);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.certificates.upload.path, async (req, res) => {
    // In a real app, we'd use multer and an OCR service or LLM to parse the doc.
    // For this demo, we'll simulate parsing by returning the first seeded cert.
    const certs = await storage.getCertificates();
    if (certs.length === 0) {
      return res.status(400).json({ message: "No certificates in registry to match against." });
    }
    
    // Simulate finding the right cert from the "uploaded document"
    const cert = certs[0];

    await storage.createAuditLog({
      certificateId: cert.id,
      action: 'Document Uploaded & Verified',
      status: 'success'
    });

    // Match the JSON structure from the user's image
    res.json({
      success: true,
      data: {
        lab_name: cert.labName,
        labtype: cert.labType,
        certificate_no: cert.certificateNo,
        ulr_number: cert.ulr,
        status: cert.status,
        issue_date: cert.dateIssued.toLocaleDateString('en-GB'),
        valid_till: cert.validTill ? cert.validTill.toISOString().split('T')[0] : null
      }
    });
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingCerts = await storage.getCertificates();
  if (existingCerts.length === 0) {
    const cert = await storage.createCertificate({
      ulr: 'TC12342500000001F',
      labName: 'CHENNAI METTEX LAB PRIVATE LIMITED',
      labType: 'Testing',
      certificateNo: 'TC-5589',
      address: '123 Test Avenue, Science Park',
      dateIssued: new Date('2024-10-19'),
      validTill: new Date('2026-06-15'),
      status: 'VALID',
      isVerified: true,
      signatureValid: true,
      scopeValid: true,
      licenseExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year from now
    });

    await storage.createTestParameter({
      certificateId: cert.id,
      name: 'pH Level',
      result: '7.2',
      specification: '6.5 - 8.5',
      isAccredited: true,
    });

    await storage.createTestParameter({
      certificateId: cert.id,
      name: 'Lead (Pb)',
      result: '0.01 ppm',
      specification: '< 0.05 ppm',
      isAccredited: true,
    });

    await storage.createAuditLog({
      certificateId: cert.id,
      action: 'Certificate Digitally Signed',
      status: 'success',
    });

    await storage.createAuditLog({
      certificateId: cert.id,
      action: 'NABL Scope Verified',
      status: 'success',
    });

    // Mock chromatogram data
    const data = [];
    for (let i = 0; i < 100; i++) {
      data.push({ time: i, intensity: Math.random() * 10 + (i === 50 ? 90 : 0) });
    }

    await storage.createChromatogram({
      certificateId: cert.id,
      name: 'GC-MS Run 1',
      data: data,
    });
    
    // Create an anomalous cert
    const cert2 = await storage.createCertificate({
      ulr: 'TC99992500000002P',
      labName: 'Questionable Analytics',
      labType: 'Calibration',
      certificateNo: 'CC-1234',
      address: '404 Unknown Street',
      dateIssued: new Date(),
      validTill: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      status: 'EXPIRED',
      isVerified: false,
      signatureValid: false,
      scopeValid: false,
      licenseExpiry: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // Expired 30 days ago
    });

    await storage.createTestParameter({
      certificateId: cert2.id,
      name: 'Mercury (Hg)',
      result: '0.15 ppm',
      specification: '< 0.1 ppm',
      isAccredited: false,
    });

    await storage.createAuditLog({
      certificateId: cert2.id,
      action: 'Signature Validation Failed',
      status: 'critical',
    });
  }
}
