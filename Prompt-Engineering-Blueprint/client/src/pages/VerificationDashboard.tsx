import { useRoute } from "wouter";
import { useCertificateByUlr } from "@/hooks/use-certificates";
import { Navbar } from "@/components/layout/Navbar";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Building2, MapPin, Calendar, CheckCircle2, XCircle, 
  FileText, ShieldAlert, ExternalLink
} from "lucide-react";

export default function VerificationDashboard() {
  const [, params] = useRoute("/dashboard/:ulr");
  const ulr = params?.ulr || "";
  
  const { data: cert, isLoading, isError } = useCertificateByUlr(ulr);

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
  const isPassed = cert?.status === "VALID";
  const failureReason = isNotFound
    ? `ULR ${ulr} does not match any uploaded record.`
    : (cert?.rejectionReason || "Validation failed.");

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 flex flex-col relative overflow-hidden">
      <div className="absolute top-[-12%] right-[-6%] w-[520px] h-[520px] bg-trust/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-12%] left-[-6%] w-[620px] h-[620px] bg-success/20 rounded-full blur-3xl"></div>
      <div className="absolute top-[30%] left-[35%] w-[360px] h-[360px] bg-warning/20 rounded-full blur-3xl"></div>
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        {/* Top Status Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-xl shadow-sm border flex items-start sm:items-center gap-4 backdrop-blur-md ${
            isPassed ? 'bg-success/10 border-success/30 text-success' : 'bg-critical/10 border-critical/30 text-critical'
          }`}
        >
          <div className="shrink-0 mt-0.5 sm:mt-0">
            {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {isPassed ? "PASSED" : "FAILED"}
            </h2>
            <p className="text-sm opacity-90 mt-0.5">
              {isPassed ? "Passed." : `Failed: ${failureReason}`}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Context & Metadata */}
          <div className="lg:col-span-4 space-y-6">
            {/* Lab Context Card */}
            <section className="bg-white/60 rounded-2xl border border-white/70 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl overflow-hidden">
              <div className="p-4 border-b border-border/60 bg-white/50">
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
                {cert?.fileUrl && (
                  <a
                    href={cert.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-trust hover:text-navy transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Uploaded Report
                  </a>
                )}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date Issued</p>
                  <p className="text-navy font-mono text-sm">{cert?.dateIssued ? format(new Date(cert.dateIssued), "MMMM do, yyyy") : 'N/A'}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Deep Data */}
          <div className="lg:col-span-8">
            <div className="bg-white/60 rounded-2xl border border-white/70 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl overflow-hidden h-full flex flex-col p-8">
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
                  <p className="text-navy font-mono font-medium text-lg">{cert?.ulr || ulr}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <div className="flex">
                    <Badge icon={isPassed ? <CheckCircle2 /> : <XCircle />} color={isPassed ? 'success' : 'critical'}>
                      {isPassed ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                </div>
                {!isPassed && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</p>
                    <p className="text-critical font-medium text-sm">{failureReason}</p>
                  </div>
                )}
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue Date</p>
                  <p className="text-navy font-mono font-medium text-lg">{cert?.dateIssued ? format(new Date(cert.dateIssued), "dd/MM/yyyy") : 'N/A'}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid Till</p>
                  <p className="text-navy font-mono font-medium text-lg">{cert?.validTill ? format(new Date(cert.validTill), "yyyy-MM-dd") : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
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
