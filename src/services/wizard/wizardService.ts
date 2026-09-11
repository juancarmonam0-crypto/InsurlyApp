import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import type { ApplicationDefinition, ApplicationRecord, FieldValue, RequirementInputType } from '../../domain/types'
import { getFieldValue, hasMeaningfulValue } from '../application/fieldAccess'
import { evaluateApplicability } from '../application/requirementsEngine'

export interface WizardQuestionOption {
  label: string
  value: string | number | boolean
}

export interface WizardQuestion {
  id: string
  canonicalField: string
  label: string
  section: string
  sectionOrder: number
  questionOrder: number
  inputType: RequirementInputType
  required: boolean
  helperText?: string
  placeholder?: string
  options?: WizardQuestionOption[]
  currentValue?: FieldValue
  profileReusable: boolean
  isResolved: boolean
}

export interface WizardSectionSummary {
  section: string
  sectionOrder: number
  totalCount: number
  resolvedCount: number
  isComplete: boolean
}

export interface SmartWizardPlan {
  definitionId: string
  definitionVersion: number
  totalApplicableQuestions: number
  completedQuestionsCount: number
  progressPercentage: number
  allQuestions: WizardQuestion[]
  unresolvedQuestions: WizardQuestion[]
  currentQuestionIndex: number
  currentQuestion: WizardQuestion | undefined
  sections: WizardSectionSummary[]
  firstUnresolvedIndex: number
  isComplete: boolean
}

export function buildWizardPlan(
  application: ApplicationRecord,
  definition?: ApplicationDefinition
): SmartWizardPlan {
  const activeDef =
    definition ??
    getApplicationDefinition(
      application.definitionId ?? 'commercial-acord125',
      application.definitionVersion ?? 2
    )

  // 1. Filter applicable requirements
  const applicableRequirements = activeDef.requirements.filter((req) =>
    evaluateApplicability(req, application)
  )

  // 2. Deterministic sorting: sectionOrder asc, questionOrder asc, original index asc
  const sortedRequirements = [...applicableRequirements].map((req, originalIndex) => ({
    req,
    originalIndex,
  }))

  sortedRequirements.sort((a, b) => {
    const sA = a.req.sectionOrder ?? 999
    const sB = b.req.sectionOrder ?? 999
    if (sA !== sB) return sA - sB

    const qA = a.req.questionOrder ?? 999
    const qB = b.req.questionOrder ?? 999
    if (qA !== qB) return qA - qB

    return a.originalIndex - b.originalIndex
  })

  // 3. Map to WizardQuestion
  const allQuestions: WizardQuestion[] = sortedRequirements.map(({ req }, index) => {
    const currentValue = getFieldValue(application, req.canonicalField)
    const isResolved = hasMeaningfulValue(currentValue)

    const isProfileReusable =
      req.profileReusable !== undefined
        ? req.profileReusable
        : req.canonicalField.startsWith('business.') ||
          req.canonicalField.startsWith('person.') ||
          req.canonicalField.startsWith('location.') ||
          req.canonicalField.startsWith('vehicle.')

    return {
      id: req.id,
      canonicalField: req.canonicalField,
      label: req.label,
      section: req.section,
      sectionOrder: req.sectionOrder ?? index + 1,
      questionOrder: req.questionOrder ?? index + 1,
      inputType: req.inputType,
      required: req.required,
      helperText: req.helperText,
      placeholder: req.placeholder,
      options: req.options,
      currentValue,
      profileReusable: isProfileReusable,
      isResolved,
    }
  })

  const unresolvedQuestions = allQuestions.filter((q) => !q.isResolved)
  const completedQuestionsCount = allQuestions.filter((q) => q.isResolved).length
  const totalApplicableQuestions = allQuestions.length
  const progressPercentage =
    totalApplicableQuestions > 0
      ? Math.round((completedQuestionsCount / totalApplicableQuestions) * 100)
      : 100

  // Build section summaries
  const sectionMap = new Map<string, { sectionOrder: number; totalCount: number; resolvedCount: number }>()
  for (const q of allQuestions) {
    const current = sectionMap.get(q.section) ?? {
      sectionOrder: q.sectionOrder,
      totalCount: 0,
      resolvedCount: 0,
    }
    current.totalCount += 1
    if (q.isResolved) current.resolvedCount += 1
    sectionMap.set(q.section, current)
  }

  const sections: WizardSectionSummary[] = Array.from(sectionMap.entries())
    .map(([section, stats]) => ({
      section,
      sectionOrder: stats.sectionOrder,
      totalCount: stats.totalCount,
      resolvedCount: stats.resolvedCount,
      isComplete: stats.totalCount > 0 && stats.totalCount === stats.resolvedCount,
    }))
    .sort((a, b) => a.sectionOrder - b.sectionOrder)

  const firstUnresolvedIndex = allQuestions.findIndex((q) => !q.isResolved)
  const currentQuestionIndex = unresolvedQuestions.length > 0 ? 0 : -1
  const currentQuestion = unresolvedQuestions[0]

  return {
    definitionId: activeDef.id,
    definitionVersion: activeDef.version,
    totalApplicableQuestions,
    completedQuestionsCount,
    progressPercentage,
    allQuestions,
    unresolvedQuestions,
    currentQuestionIndex,
    currentQuestion,
    sections,
    firstUnresolvedIndex,
    isComplete: unresolvedQuestions.length === 0,
  }
}
