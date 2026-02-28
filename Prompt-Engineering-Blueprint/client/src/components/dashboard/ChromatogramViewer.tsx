import type { Chromatogram } from "@shared/schema";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Activity } from "lucide-react";

export function ChromatogramViewer({ data }: { data: Chromatogram[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-slate-50 text-muted-foreground">
        <Activity className="w-10 h-10 mb-4 text-slate-300" />
        <p>No raw instrument metadata associated with this report.</p>
      </div>
    );
  }

  // Example for rendering the first chromatogram attached
  const activeChart = data[0];
  const chartData = activeChart.data as Array<{ time: number, intensity: number }>;

  // Calculate some simple baselines or anomalies if needed for demonstration
  const maxIntensity = Math.max(...chartData.map(d => d.intensity));
  const threshold = maxIntensity * 0.8; 

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy">{activeChart.name}</h3>
          <p className="text-sm text-muted-foreground">GC-MS Retention Time vs Signal Intensity</p>
        </div>
        <div className="flex gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-trust"></span> Data Signal
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-warning"></span> Threshold Baseline
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full bg-white p-4 border border-border rounded-xl shadow-sm">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
              axisLine={false}
              tickLine={false}
              label={{ value: "Retention Time (min)", position: "insideBottom", offset: -10, fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
              axisLine={false}
              tickLine={false}
              label={{ value: "Intensity (mV)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              itemStyle={{ color: "hsl(var(--navy))", fontWeight: 600 }}
            />
            <ReferenceLine y={threshold} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
            <Line 
              type="monotone" 
              dataKey="intensity" 
              stroke="hsl(var(--trust))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "hsl(var(--trust))", stroke: "white", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
