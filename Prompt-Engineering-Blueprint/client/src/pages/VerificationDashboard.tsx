import { useRoute } from "wouter";
import { useCertificateByUlr } from "@/hooks/use-certificates";
import { Navbar } from "@/components/layout/Navbar";
import { UlrDecoder } from "@/components/dashboard/UlrDecoder";
import { ParameterTable } from "@/components/dashboard/ParameterTable";
import { ChromatogramViewer } from "@/components/dashboard/ChromatogramViewer";
import { AuditTimeline } from "@/components/dashboard/AuditTimeline";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Building2, MapPin, Calendar, CheckCircle2, XCircle, AlertTriangle, 
  FileText, Activity, History, ShieldAlert, ShieldCheck
} from "lucide-react";
import { useState } from "react";

export default function VerificationDashboard() {
  const [, params] = useRoute("/dashboard/:ulr");
  const ulr = params?.ulr || "";
  
  const { data: cert, isLoading, isError } = useCertificateByUlr(ulr);
  const [activeTab, setActiveTab] = useState<'params' | 'raw' | 'audit'>('params');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-trust border-t-transparent animate-spin"></div>
            <FileText className="w-6 h-6 text-trust" />
          </div>
          <p className="text-navy font-semibold animate-pulse">Running Compliance Verification Protocol...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-border shadow-xl text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-navy mb-2 font-display">System Error</h2>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred while communicating with the verification registry. Please try again later.
            </p>
            <button 
              onClick={() => window.history.back()}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-navy font-semibold rounded-lg transition-colors"
            >
              Return to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not loading and no certificate found, we still show the dashboard but in an "Invalid" state
  const isNotFound = !cert;
  
  // Derive top-level status
  const isFullyVerified = cert?.isVerified && cert?.signatureValid && cert?.scopeValid;
  const hasAnomalies = cert?.testParameters?.some(p => !p.isAccredited) || !cert?.scopeValid;
  const isCritical = isNotFound || !cert?.isVerified || !cert?.signatureValid;
  const isLicenseExpired = cert?.licenseExpiry ? new Date(cert.licenseExpiry) < new Date() : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Top Status Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-xl shadow-sm border flex items-start sm:items-center gap-4 ${
            isCritical || isLicenseExpired ? 'bg-critical/10 border-critical/30 text-critical' :
            hasAnomalies ? 'bg-warning/10 border-warning/30 text-warning' :
            'bg-success/10 border-success/30 text-success'
          }`}
        >
          <div className="shrink-0 mt-0.5 sm:mt-0">
            {isCritical || isLicenseExpired ? <XCircle className="w-8 h-8" /> : 
             hasAnomalies ? <AlertTriangle className="w-8 h-8" /> : 
             <CheckCircle2 className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {isNotFound ? 'Invalid Report: Record Not Found' :
               isLicenseExpired ? 'Laboratory License Expired' :
               isCritical ? 'Critical Assurance Failure' :
               hasAnomalies ? 'Review by Exception: Anomalies Detected' :
               'Full Compliance Assured'}
            </h2>
            <p className="text-sm opacity-90 mt-0.5">
              {isNotFound ? `The ULR ${ulr} does not match any authenticated record in the NABL registry. This report is considered invalid.` :
               isLicenseExpired ? `The issuing laboratory's NABL license expired on ${cert?.licenseExpiry ? format(new Date(cert.licenseExpiry), "MMM do, yyyy") : 'N/A'}.` :
               isCritical ? 'The laboratory identity or digital signatures failed cryptographic validation. Do not accept this report.' :
               hasAnomalies ? 'Report is authentic, but contains parameters outside the approved accreditation scope. Manual review required.' :
               'All cryptographic hashes, scope parameters, and raw data signatures match registry records.'}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Context & Metadata */}
          <div className="lg:col-span-4 space-y-6">
            {/* Lab Context Card */}
            <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50">
                <h3 className="font-semibold text-navy flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-trust" /> Issuing Laboratory
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Entity Name</p>
                  <p className="text-navy font-medium">{cert?.labName || 'Unknown Laboratory'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Registered Address</p>
                  <p className="text-navy text-sm leading-relaxed">{cert?.address || 'Address not found in registry'}</p>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date Issued</p>
                  <p className="text-navy font-mono text-sm">{cert?.dateIssued ? format(new Date(cert.dateIssued), "MMMM do, yyyy") : 'N/A'}</p>
                </div>
              </div>
            </section>

            {/* ULR Decoder Card */}
            <section className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <UlrDecoder ulr={ulr} />
            </section>
            
            {/* Status Summary Card */}
            <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
               <div className="p-4 border-b border-border bg-slate-50">
                <h3 className="font-semibold text-navy flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-trust" /> Verification Matrix
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <StatusRow label="Report Authenticity" status={cert?.isVerified ? 'pass' : 'fail'} />
                <StatusRow label="Digital Signatures" status={cert?.signatureValid ? 'pass' : 'fail'} />
                <StatusRow label="Scope Validation" status={cert?.scopeValid ? 'pass' : 'warn'} />
                <StatusRow label="Laboratory License" status={isLicenseExpired || isNotFound ? 'fail' : 'pass'} />
              </div>
            </section>
          </div>

          {/* Right Column: Deep Data */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden h-full flex flex-col p-8">
              <h3 className="text-xl font-bold text-navy mb-6 font-display">Certificate Verification Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lab Name</p>
                  <p className="text-navy font-medium text-lg">{cert?.labName || 'N/A'}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lab Type</p>
                  <p className="text-navy font-medium text-lg">{cert?.labType || 'N/A'}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Certificate Number</p>
                  <p className="text-navy font-mono font-medium text-lg">{cert?.certificateNo || 'N/A'}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ULR Number</p>
                  <p className="text-navy font-mono font-medium text-lg">{ulr}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <div className="flex">
                    <Badge icon={cert?.status === 'VALID' ? <CheckCircle2 /> : <XCircle />} color={cert?.status === 'VALID' ? 'success' : 'critical'}>
                      {cert?.status || 'INVALID'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue Date</p>
                  <p className="text-navy font-mono font-medium text-lg">{cert?.dateIssued ? format(new Date(cert.dateIssued), "dd/MM/yyyy") : 'N/A'}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid Till</p>
                  <p className="text-navy font-mono font-medium text-lg">{cert?.validTill ? format(new Date(cert.validTill), "yyyy-MM-dd") : 'N/A'}</p>
                </div>
              </div>

              {(isLicenseExpired || isNotFound) && (
                <div className="mt-8 p-4 bg-critical/5 border border-critical/20 rounded-xl flex items-center gap-3 text-critical">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="text-sm font-semibold">
                    {isNotFound ? 'Report details could not be found in the authoritative registry.' : 'Laboratory license has expired or is currently invalid.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusRow({ label, status }: { label: string, status: 'pass' | 'fail' | 'warn' }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {status === 'pass' && <Badge icon={<CheckCircle2 />} color="success">Verified</Badge>}
      {status === 'warn' && <Badge icon={<AlertTriangle />} color="warning">Warning</Badge>}
      {status === 'fail' && <Badge icon={<XCircle />} color="critical">Failed</Badge>}
    </div>
  );
}

function Badge({ children, icon, color }: { children: React.ReactNode, icon: React.ReactNode, color: 'success'|'warning'|'critical' }) {
  const colorMap = {
    success: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    critical: 'text-critical bg-critical/10 border-critical/20'
  };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorMap[color]}`}>
      <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>
      {children}
    </span>
  );
}

function TabButton({ 
  active, onClick, icon, label, count, hasWarning 
}: { 
  active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number, hasWarning?: boolean 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap
        ${active 
          ? 'border-trust text-navy bg-white rounded-t-lg' 
          : 'border-transparent text-muted-foreground hover:text-navy hover:bg-slate-100 rounded-t-lg'}
      `}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          hasWarning ? 'bg-warning text-white' : 
          active ? 'bg-navy text-white' : 'bg-slate-200 text-slate-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
