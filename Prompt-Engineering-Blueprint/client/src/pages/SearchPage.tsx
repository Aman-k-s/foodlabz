import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useVerifyCertificate, useUploadCertificate } from "@/hooks/use-certificates";
import { Building2, ShieldCheck, Search, ArrowRight, Loader2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/common/BrandLogo";

export default function SearchPage() {
  const [ulr, setUlr] = useState("");
  const [, setLocation] = useLocation();
  const verifyMutation = useVerifyCertificate();
  const uploadMutation = useUploadCertificate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (uploadMutation.isPending) {
      setUploadProgress((current) => (current < 10 ? 10 : current));
      progressTimerRef.current = window.setInterval(() => {
        setUploadProgress((current) => {
          if (current >= 92) return current;
          const delta = current < 60 ? 6 : 2;
          return Math.min(92, current + delta);
        });
      }, 500);
    } else {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setUploadProgress(0);
    }

    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [uploadMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUploadedFileUrl(null);

    const normalized = ulr.replace(/\s+/g, "").toUpperCase();
    if (normalized.length !== 18) {
      setErrorMsg("ULR must be exactly 18 characters.");
      return;
    }

    verifyMutation.mutate(normalized, {
      onSuccess: () => {
        setLocation(`/dashboard/${normalized}`);
      },
      onError: (err: any) => {
        setErrorMsg(err?.message || "Verification failed.");
      },
    });
  };

  const processUpload = (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Only PDF files are supported.");
      return;
    }

    setErrorMsg(null);
    setUploadedFileUrl(null);
    setUploadProgress(10);
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setUploadProgress(100);
        const normalizedUlr = (data.ulr || "").trim();
        if (normalizedUlr) {
          setLocation(`/dashboard/${encodeURIComponent(normalizedUlr)}`);
          return;
        }

        if (data.fileUrl) {
          setUploadedFileUrl(data.fileUrl);
        }
        setErrorMsg(
          data.rejectionReason ||
            "Upload completed, but ULR/certificate number could not be extracted from this report.",
        );
      },
      onError: (err: any) => {
        setUploadProgress(0);
        setErrorMsg(err?.message || "Failed to process document. Please try manual entry.");
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processUpload(file as File);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (verifyMutation.isPending || uploadMutation.isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!uploadMutation.isPending && !verifyMutation.isPending) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 p-4 relative overflow-hidden">
      <div className="absolute top-[-12%] right-[-6%] w-[520px] h-[520px] bg-trust/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-12%] left-[-6%] w-[620px] h-[620px] bg-success/20 rounded-full blur-3xl"></div>
      <div className="absolute top-[25%] left-[35%] w-[360px] h-[360px] bg-warning/20 rounded-full blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl z-10"
      >
        <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-cyan-500/20 border border-white/70 p-8 md:p-12 text-center">
          <div className="mx-auto mb-6 flex items-center justify-center">
            <BrandLogo
              className="h-14 w-auto object-contain"
              fallbackClassName="w-16 h-16 bg-navy rounded-2xl flex items-center justify-center shadow-lg shadow-navy/20"
            />
          </div>

          <h2 className="text-3xl font-bold text-navy mb-3 font-display">FoodLabz Report Verification</h2>
          <p className="text-muted-foreground mb-10">
            Enter the 18-digit NABL ULR sequence or upload a test report to begin compliance validation.
          </p>

          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              <div>
                <label htmlFor="ulr" className="block text-sm font-semibold text-navy mb-2 ml-1">
                  ULR Sequence
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-trust transition-colors" />
                  </div>
                  <input
                    id="ulr"
                    type="text"
                    className={`
                      block w-full pl-11 pr-4 py-4 rounded-xl text-lg font-mono tracking-widest uppercase
                      bg-slate-50/80 border-2 transition-all duration-200
                      placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans placeholder:normal-case
                      focus:outline-none focus:bg-white
                      ${errorMsg ? "border-critical focus:border-critical focus:ring-4 focus:ring-critical/10" : "border-border focus:border-trust focus:ring-4 focus:ring-trust/10"}
                    `}
                    placeholder="e.g. TC12342500000001F"
                    value={ulr}
                    onChange={(e) => {
                      setUlr(e.target.value.toUpperCase());
                      setErrorMsg(null);
                    }}
                    maxLength={25}
                    disabled={verifyMutation.isPending || uploadMutation.isPending}
                  />
                </div>
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 text-sm text-critical font-medium flex items-center gap-1.5 ml-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-critical"></span>
                    {errorMsg}
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                disabled={verifyMutation.isPending || uploadMutation.isPending || !ulr}
                className={`
                  w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white
                  transition-all duration-300 shadow-lg
                  ${verifyMutation.isPending || uploadMutation.isPending || !ulr
                    ? "bg-slate-300 shadow-none cursor-not-allowed"
                    : "bg-trust hover:bg-navy hover:shadow-xl hover:-translate-y-0.5 shadow-trust/30"}
                `}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Initiating Protocol...
                  </>
                ) : (
                  <>
                    Verify Authenticity
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or upload document</span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending || verifyMutation.isPending}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold border-2 border-dashed
                transition-all duration-300
                ${uploadMutation.isPending
                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                  : isDragging
                    ? "border-trust text-trust bg-trust/10"
                    : "border-trust/30 text-trust hover:border-trust hover:bg-trust/5"}
              `}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Document...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload or Drag & Drop PDF
                </>
              )}
            </button>
            {uploadMutation.isPending && (
              <div className="w-full">
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-trust transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  Processing report... {uploadProgress}%
                </p>
              </div>
            )}
            {uploadedFileUrl && (
              <a
                href={uploadedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-trust hover:text-navy transition-colors"
              >
                <Upload className="w-4 h-4" />
                Open Uploaded File
              </a>
            )}
            <Link
              href="/labs"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white/80 py-3 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
            >
              <Building2 className="h-4 w-4" />
              View Lab Details
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-success" /> 256-bit Encrypted</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-success" /> 21 CFR Part 11 Compliant</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
