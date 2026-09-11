import React, { useEffect, useRef } from 'react'
import type { FieldValue, RequirementInputType } from '../../domain/types'
import type { WizardQuestion } from './wizardService'

export interface QuestionRendererProps {
  question: WizardQuestion
  value: FieldValue
  onChange: (val: FieldValue) => void
  onSubmit?: () => void
  autoFocus?: boolean
  disabled?: boolean
}

export type QuestionRendererComponent = React.FC<QuestionRendererProps>

// 1. Text Renderer
export const TextQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [question.id, autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="input"
      placeholder={question.placeholder ?? 'Enter answer...'}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={question.label}
    />
  )
}

// 2. Number Renderer
export const NumberQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [question.id, autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <input
      ref={inputRef}
      type="number"
      className="input"
      placeholder={question.placeholder ?? '0'}
      value={value !== undefined && value !== null ? String(value) : ''}
      onChange={(e) => {
        const val = e.target.value
        onChange(val === '' ? '' : Number(val))
      }}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={question.label}
    />
  )
}

// 3. Currency Renderer
export const CurrencyQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [question.id, autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <span
        style={{
          position: 'absolute',
          left: '0.85rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#64748b',
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        $
      </span>
      <input
        ref={inputRef}
        type="number"
        className="input"
        style={{ paddingLeft: '2rem' }}
        placeholder={question.placeholder ?? '0'}
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === '' ? '' : Number(val))
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={question.label}
      />
    </div>
  )
}

// 4. Date Renderer
export const DateQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [question.id, autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <input
      ref={inputRef}
      type="date"
      className="input"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={question.label}
    />
  )
}

// 5. Boolean Renderer
export const BooleanQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <button
        type="button"
        className={`button ${value === true ? '' : 'button--secondary'}`}
        style={{ flex: 1 }}
        onClick={() => onChange(true)}
        disabled={disabled}
      >
        Yes
      </button>
      <button
        type="button"
        className={`button ${value === false ? '' : 'button--secondary'}`}
        style={{ flex: 1 }}
        onClick={() => onChange(false)}
        disabled={disabled}
      >
        No
      </button>
    </div>
  )
}

// 6. Select Renderer
export const SelectQuestionRenderer: QuestionRendererComponent = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <select
      className="input"
      value={value !== undefined && value !== null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={question.label}
    >
      <option value="">Select an option...</option>
      {question.options?.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Registry Map
export const QUESTION_RENDERER_REGISTRY: Record<RequirementInputType, QuestionRendererComponent> = {
  text: TextQuestionRenderer,
  number: NumberQuestionRenderer,
  currency: CurrencyQuestionRenderer,
  date: DateQuestionRenderer,
  boolean: BooleanQuestionRenderer,
  select: SelectQuestionRenderer,
  'multi-select': SelectQuestionRenderer,
  address: TextQuestionRenderer,
  person: TextQuestionRenderer,
  vehicle: TextQuestionRenderer,
  file_upload: TextQuestionRenderer,
}

export const getQuestionRenderer = (type: RequirementInputType): QuestionRendererComponent => {
  return QUESTION_RENDERER_REGISTRY[type] ?? TextQuestionRenderer
}
