import type { AuditLog } from "@shared/schema";
import { format } from "date-fns";
import { ShieldCheck, AlertTriangle, FileSearch, Server, CheckCircle2, XCircle } from "lucide-react";

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  // Sort logs by timestamp descending
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
  );

  return (
    <div className="relative border-l-2 border-border ml-4 space-y-8 py-4">
      {sortedLogs.map((log, index) => {
        const isLatest = index === 0;
        const Icon = getIconForAction(log.action, log.status);
        
        return (
          <div key={log.id} className="relative pl-8 group">
            <div className={`absolute -left-[17px] top-1 rounded-full p-1 border-2 border-white
              ${log.status === 'success' ? 'bg-success text-white' : 
                log.status === 'warning' ? 'bg-warning text-white' : 
                log.status === 'critical' ? 'bg-critical text-white' : 
                'bg-slate-200 text-slate-500'}
              ${isLatest ? 'ring-4 ring-trust/20' : ''}
              transition-transform group-hover:scale-110
            `}>
              <Icon className="w-4 h-4" />
            </div>
            
            <div className={`p-4 rounded-xl border transition-all ${
              isLatest ? 'bg-white shadow-md border-border' : 'bg-slate-50 border-transparent hover:border-border hover:bg-white'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                <h4 className={`font-semibold ${
                  log.status === 'critical' ? 'text-critical' : 
                  log.status === 'warning' ? 'text-warning' : 'text-navy'
                }`}>
                  {log.action}
                </h4>
                <time className="text-xs font-mono text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                  {log.timestamp ? format(new Date(log.timestamp), "MMM d, yyyy • HH:mm:ss.SSS") : 'Unknown Time'}
                </time>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {getStatusDescription(log.action, log.status)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getIconForAction(action: string, status: string) {
  if (status === 'critical') return XCircle;
  if (status === 'warning') return AlertTriangle;
  
  if (action.toLowerCase().includes('signature')) return ShieldCheck;
  if (action.toLowerCase().includes('metadata')) return Server;
  if (action.toLowerCase().includes('decode') || action.toLowerCase().includes('ulr')) return FileSearch;
  
  return CheckCircle2;
}

function getStatusDescription(action: string, status: string) {
  if (status === 'critical') return "Critical failure in verification protocol. Process halted.";
  if (status === 'warning') return "Anomaly detected requiring manual review by Quality Assurance Officer.";
  return "Protocol successfully executed and cryptographically signed.";
}
