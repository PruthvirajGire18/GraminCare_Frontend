import { useEffect, useRef, useState } from 'react'
import { verifyReferralToken } from '../services/referral.service.js'

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

function ReferralVerifyPage() {
  const [token] = useState(() => window.location.hash.slice(1))
  const [referral, setReferral] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(token))
  const [error, setError] = useState(() => token ? '' : 'Referral invalid or expired.')
  const verificationRequest = useRef(null)

  useEffect(() => {
    let active = true
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    if (!token) {
      return () => { active = false }
    }

    verificationRequest.current ||= verifyReferralToken(token)
    verificationRequest.current
      .then((result) => { if (active) setReferral(result) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Referral invalid or expired.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  return (
    <main className="content-width referral-verify-page">
      <section className="referral-verify-card" aria-live="polite">
        <p className="eyebrow"><span className="eyebrow-dot" /> Secure referral verification</p>
        {loading ? <p className="patient-state" role="status">Verifying referral…</p> : error ? (
          <div className="referral-invalid"><h1>Referral invalid or expired.</h1><p>This QR is invalid, expired, revoked, or has already been used.</p></div>
        ) : referral ? (
          <>
            <h1>Referral verified</h1>
            <p className="referral-verified-note">This one-time referral token has been used for verification.</p>
            <dl className="referral-verify-details">
              <div><dt>Patient reference</dt><dd>{referral.patientReference}</dd></div>
              <div><dt>Priority</dt><dd className={`referral-${referral.priority.toLowerCase()}`}>{referral.priority}</dd></div>
              <div><dt>Referred by</dt><dd>{referral.doctorName}</dd></div>
              <div><dt>Referral reason</dt><dd>{referral.reason}</dd></div>
              {referral.destination?.facilityName && <div><dt>Destination</dt><dd>{referral.destination.facilityName}{referral.destination.address ? ` · ${referral.destination.address}` : ''}</dd></div>}
              <div><dt>Created</dt><dd>{formatDate(referral.createdAt)}</dd></div>
              <div><dt>Expires</dt><dd>{formatDate(referral.expiresAt)}</dd></div>
            </dl>
            <p className="referral-data-note">This verification contains referral details only. It does not expose the patient’s full medical history.</p>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default ReferralVerifyPage
