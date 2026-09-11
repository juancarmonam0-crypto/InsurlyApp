import type { FieldValue } from '../../domain/types'

const numericPattern = /^\$?\s*-?[\d,]+(?:\.\d+)?$/

export const normalizeFieldValue = (value: FieldValue | undefined) => {
  if (typeof value === 'number') return { type: 'number' as const, value }

  if (typeof value === 'boolean') return { type: 'boolean' as const, value }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    const compact = trimmed.replaceAll(',', '')

    if (numericPattern.test(trimmed)) {
      const numeric = Number(compact.replace(/\$/g, ''))
      if (!Number.isNaN(numeric)) {
        return { type: 'number' as const, value: numeric }
      }
    }

    const lowered = trimmed.toLowerCase()
    if (['true', 'yes', 'y'].includes(lowered)) return { type: 'boolean' as const, value: true }
    if (['false', 'no', 'n'].includes(lowered)) return { type: 'boolean' as const, value: false }

    return { type: 'string' as const, value: lowered.replace(/\s+/g, ' ') }
  }

  if (Array.isArray(value)) {
    return { type: 'array' as const, value: value.map((entry) => entry.trim().toLowerCase()) }
  }

  return { type: 'empty' as const, value: null }
}

export const valuesEquivalent = (left: FieldValue | undefined, right: FieldValue | undefined) => {
  const normalizedLeft = normalizeFieldValue(left)
  const normalizedRight = normalizeFieldValue(right)

  if (normalizedLeft.type !== normalizedRight.type) return false

  if (normalizedLeft.type === 'array' && normalizedRight.type === 'array') {
    return normalizedLeft.value.length === normalizedRight.value.length
      && normalizedLeft.value.every((value, index) => value === normalizedRight.value[index])
  }

  return normalizedLeft.value === normalizedRight.value
}
