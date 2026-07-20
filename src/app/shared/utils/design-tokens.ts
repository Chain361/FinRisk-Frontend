export const PALETTE = {
  navy: '#0b3164',
  ink: '#132036',
  muted: '#5b6b7d',
  line: '#b9c2cc',
  chartBlue: '#5b8fc7',
  chartBlueDeep: '#1c5187',
  chartRed: '#a33b2c',
  chartOrange: '#c98a3a',
  riskHigh: '#b91c1c',
  riskMedium: '#b45309',
  riskLow: '#15803d',
  gray: '#64748b',
} as const;

export const CHART_SERIES_COLORS = [
  PALETTE.navy,
  PALETTE.chartBlue,
  PALETTE.chartOrange,
  PALETTE.chartRed,
  PALETTE.chartBlueDeep,
] as const;

export const RISK_SERIES = [
  { level: 'high', name: 'เสี่ยงสูง', color: PALETTE.riskHigh },
  { level: 'medium', name: 'เสี่ยงปานกลาง', color: PALETTE.riskMedium },
  { level: 'low', name: 'เสี่ยงต่ำ', color: PALETTE.riskLow },
] as const;
