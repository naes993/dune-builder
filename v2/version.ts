export const V2_BUILD = {
  id: 'v2-dev-0033',
  date: '2026-06-15',
  description: 'Performance: removed a per-frame solvePlacement/setPreview churn (scaled with build size, pegged the main thread) and switched the canvas to on-demand rendering with a capped pixel ratio — big drop in idle/tilt lag.',
} as const;
