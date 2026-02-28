import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  ulr: text("ulr").notNull().unique(), // e.g., TC12342500000001F
  labName: text("lab_name").notNull(),
  labType: text("lab_type").notNull().default("Testing"),
  certificateNo: text("certificate_no").notNull(),
  address: text("address").notNull(),
  dateIssued: timestamp("date_issued").notNull(),
  validTill: timestamp("valid_till"),
  status: text("status").notNull().default("VALID"),
  isVerified: boolean("is_verified").default(false),
  signatureValid: boolean("signature_valid").default(false),
  scopeValid: boolean("scope_valid").default(false), // derived from ULR (F or P)
  licenseExpiry: timestamp("license_expiry"),
});

export const testParameters = pgTable("test_parameters", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
  name: text("name").notNull(),
  result: text("result").notNull(),
  specification: text("specification").notNull(),
  isAccredited: boolean("is_accredited").default(true),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
  action: text("action").notNull(), // e.g. "Signature Verified", "Metadata Extracted", "ULR Decoded"
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").notNull(), // "success", "warning", "critical"
});

export const chromatograms = pgTable("chromatograms", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
  name: text("name").notNull(), // e.g., "GC-MS Run 1"
  data: jsonb("data").notNull(), // array of { time: number, intensity: number }
});

export const certificatesRelations = relations(certificates, ({ many }) => ({
  testParameters: many(testParameters),
  auditLogs: many(auditLogs),
  chromatograms: many(chromatograms),
}));

export const testParametersRelations = relations(testParameters, ({ one }) => ({
  certificate: one(certificates, {
    fields: [testParameters.certificateId],
    references: [certificates.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  certificate: one(certificates, {
    fields: [auditLogs.certificateId],
    references: [certificates.id],
  }),
}));

export const chromatogramsRelations = relations(chromatograms, ({ one }) => ({
  certificate: one(certificates, {
    fields: [chromatograms.certificateId],
    references: [certificates.id],
  }),
}));

export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true });
export const insertTestParameterSchema = createInsertSchema(testParameters).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertChromatogramSchema = createInsertSchema(chromatograms).omit({ id: true });

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type TestParameter = typeof testParameters.$inferSelect;
export type InsertTestParameter = z.infer<typeof insertTestParameterSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Chromatogram = typeof chromatograms.$inferSelect;
export type InsertChromatogram = z.infer<typeof insertChromatogramSchema>;

// Full certificate response including relations
export type CertificateResponse = Certificate & {
  testParameters: TestParameter[];
  auditLogs: AuditLog[];
  chromatograms: Chromatogram[];
};
