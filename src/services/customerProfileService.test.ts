import { describe, expect, test } from 'vitest'
import { demoApplication, demoCustomer } from '../data/mock/insurly'
import { promoteConfirmedApplicationFactsToProfile } from './customerProfileService'
import { answerRequirement, confirmCustomerReview, recalculateApplication } from './application/workflow'
import { getFieldValue } from './application/fieldAccess'

describe('customerProfileService & profile promotion', () => {
  test('promoteConfirmedApplicationFactsToProfile promotes profileReusable fields when confirmed', () => {
    let app = recalculateApplication(structuredClone(demoApplication))
    app = answerRequirement(app, 'business.yearsInBusiness', 10)
    app = answerRequirement(app, 'application.desiredEffectiveDate', '2027-06-01')
    app = confirmCustomerReview(app)

    const updatedCustomer = promoteConfirmedApplicationFactsToProfile(demoCustomer, app)

    // Reusable field should be promoted
    const yearsInBusinessFact = updatedCustomer.profile.facts?.find((f) => f.fieldKey === 'business.yearsInBusiness')
    expect(yearsInBusinessFact).toBeTruthy()
    expect(yearsInBusinessFact?.value).toBe(10)

    // Application-only fact (application.desiredEffectiveDate) MUST NOT be promoted to profile facts
    const policyDateFact = updatedCustomer.profile.facts?.find((f) => f.fieldKey === 'application.desiredEffectiveDate')
    expect(policyDateFact).toBeUndefined()
  })

  test('fieldStates takes precedence over profile in fieldAccess and does not mutate Customer entity directly', () => {
    let app = recalculateApplication(structuredClone(demoApplication))
    app = answerRequirement(app, 'business.legalName', 'Cedar Ridge Landscaping Group')

    // Root Customer record profile remains unchanged until confirmed/promoted
    expect(demoCustomer.profile.business.legalName).toBe('Cedar Ridge Services LLC')

    // getFieldValue yields the updated fieldState value for the application
    expect(getFieldValue(app, 'business.legalName')).toBe('Cedar Ridge Landscaping Group')
  })
})
