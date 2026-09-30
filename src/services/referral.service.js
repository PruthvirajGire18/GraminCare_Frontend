import api from './api.js'

export async function verifyReferralToken(token) {
  const { data } = await api.post('/referrals/verify', { token })
  return data.referral
}
