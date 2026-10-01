import assert from 'node:assert/strict'
import test from 'node:test'
import { createReferralQrDataUrl } from './referralQr.js'

test('doctor dashboard referral link generates a scannable QR image', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost:5174' } },
  })
  try {
    const token = `REF-${'a'.repeat(64)}`
    const qr = await createReferralQrDataUrl(`/doctor#${token}`)
    assert.match(qr, /^data:image\/png;base64,/)
    assert.ok(qr.length > 1000)
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  }
})

test('QR helper rejects links outside the same-origin referral routes', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost:5174' } },
  })
  try {
    await assert.rejects(createReferralQrDataUrl(`https://attacker.example/referral/verify#REF-${'a'.repeat(64)}`), /link is invalid/)
    await assert.rejects(createReferralQrDataUrl('/referral/verify?token=REF-token'), /link is invalid/)
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  }
})
