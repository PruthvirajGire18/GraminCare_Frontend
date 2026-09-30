import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeVisitForOffline } from './validation.js'

test('offline follow-up validation preserves doctor consultation links', () => {
  const followUp = normalizeVisitForOffline({
    visitType: 'FOLLOW_UP',
    followUpConsultationId: '507f1f77bcf86cd799439013',
    symptoms: { chiefComplaint: 'Review symptoms' },
    visitDate: new Date().toISOString(),
  })
  assert.equal(followUp.followUpConsultationId, '507f1f77bcf86cd799439013')
  assert.equal(followUp.followUpOf, null)
})

test('offline follow-up validation requires exactly one scheduled item', () => {
  const base = { visitType: 'FOLLOW_UP', symptoms: { chiefComplaint: 'Review symptoms' } }
  assert.throws(() => normalizeVisitForOffline(base), /scheduled item/i)
  assert.throws(() => normalizeVisitForOffline({
    ...base,
    followUpOf: 'local-visit-id',
    followUpConsultationId: '507f1f77bcf86cd799439013',
  }), /one scheduled item/i)
  assert.throws(() => normalizeVisitForOffline({
    ...base,
    followUpConsultationId: 'not-an-object-id',
  }), /valid doctor follow-up/i)
})
