import type { TestParameter } from "@shared/schema";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ParameterTable({ parameters }: { parameters: TestParameter[] }) {
  const hasAnomalies = parameters.some(p => !p.isAccredited);

  return (
    <div className="space-y-4">
      {hasAnomalies && (
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3 text-warning">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">Warning: This report contains test parameters outside the laboratory's approved NABL scope.</p>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Test Parameter</th>
                <th className="px-6 py-4 font-semibold">Result</th>
                <th className="px-6 py-4 font-semibold">Specification Limits</th>
                <th className="px-6 py-4 font-semibold text-right">Scope Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parameters.map((param) => (
                <tr 
                  key={param.id} 
                  className={`hover:bg-slate-50/50 transition-colors ${
                    !param.isAccredited ? 'bg-warning/5 hover:bg-warning/10' : ''
                  }`}
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    {param.name}
                  </td>
                  <td className="px-6 py-4 font-mono">{param.result}</td>
                  <td className="px-6 py-4 text-muted-foreground">{param.specification}</td>
                  <td className="px-6 py-4 text-right">
                    {param.isAccredited ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accredited
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                        <AlertCircle className="w-3.5 h-3.5" /> Out of Scope
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
