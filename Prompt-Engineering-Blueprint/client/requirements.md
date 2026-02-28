## Packages
recharts | Required for rendering instrument chromatogram raw data visualizations
date-fns | Required for human-readable audit log and certificate timestamps
framer-motion | Required for smooth, premium entry animations and layout transitions
clsx | Required for dynamic class name merging in UI components
tailwind-merge | Required for resolving Tailwind class conflicts safely

## Notes
Tailwind Config - extend colors:
colors: {
  navy: "hsl(var(--navy))",
  trust: "hsl(var(--trust))",
  warning: "hsl(var(--warning))",
  critical: "hsl(var(--critical))",
  success: "hsl(var(--success))",
}
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  mono: ["var(--font-mono)"],
}
