export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW'

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.60,
} as const

export const getConfidenceTier = (confidence: number): ConfidenceTier => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH'
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

export const isHighConfidence = (confidence: number): boolean => confidence >= CONFIDENCE_THRESHOLDS.HIGH

export const isMediumConfidence = (confidence: number): boolean =>
  confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && confidence < CONFIDENCE_THRESHOLDS.HIGH

export const isLowConfidence = (confidence: number): boolean => confidence < CONFIDENCE_THRESHOLDS.MEDIUM
