import { parseUlr } from "@/lib/ulr-parser";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function UlrDecoder({ ulr }: { ulr: string }) {
  const parsed = parseUlr(ulr);
  
  if (!parsed.isValid) {
    return (
      <div className="p-4 border border-critical/20 bg-critical/5 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-critical shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-critical">Invalid ULR Format</h4>
          <p className="text-sm text-muted-foreground mt-1">The provided sequence does not match the NABL cryptographic format.</p>
        </div>
      </div>
    );
  }

  const isPartial = parsed.scopeFlag === 'P';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">ULR Cryptographic Sequence</h3>
        {isPartial ? (
          <Badge variant="outline" className="border-warning text-warning bg-warning/10 gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Partial Scope
          </Badge>
        ) : (
          <Badge variant="outline" className="border-success text-success bg-success/10 gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Full Scope
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <SegmentBox label="Type" value={parsed.type} tooltip="Accreditation Discipline" />
        <SegmentBox label="Cert #" value={parsed.certNumber} tooltip="Certificate Identifier" />
        <SegmentBox label="Year" value={`20${parsed.year}`} tooltip="Temporal Marker" />
        <SegmentBox label="Node" value={parsed.locationNode} tooltip="Geographic Location" />
        <SegmentBox label="Ledger" value={parsed.ledger} tooltip="Sequential Tracker" isHex />
        <SegmentBox 
          label="Scope" 
          value={parsed.scopeFlag} 
          tooltip="Validation Flag" 
          highlight={isPartial ? "warning" : "success"}
        />
      </div>
    </div>
  );
}

function SegmentBox({ 
  label, value, tooltip, isHex, highlight 
}: { 
  label: string, value: string, tooltip: string, isHex?: boolean, highlight?: 'warning'|'success' 
}) {
  return (
    <div 
      className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all hover:shadow-md
        ${highlight === 'warning' ? 'bg-warning/10 border-warning/30' : 
          highlight === 'success' ? 'bg-success/10 border-success/30' : 
          'bg-slate-50 border-border hover:border-navy/20'}`}
      title={tooltip}
    >
      <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{label}</span>
      <span className={`font-mono font-bold text-lg ${
        highlight === 'warning' ? 'text-warning' : 
        highlight === 'success' ? 'text-success' : 
        'text-navy'
      }`}>
        {value}
      </span>
      {isHex && <span className="text-[8px] text-muted-foreground mt-0.5">HEX</span>}
    </div>
  );
}
