const RISK_LEVELS = [
  { key: 'LOW', label: 'LOW', className: 'low' },
  { key: 'MEDIUM', label: 'MEDIUM', className: 'medium' },
  { key: 'HIGH', label: 'HIGH', className: 'high' },
  { key: 'CRITICAL', label: 'CRITICAL', className: 'critical' },
]

function displayCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '—'
}

function MetricCard({ label, value, detail, tone = '' }) {
  return (
    <article className={`admin-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function RiskDistribution({ distribution = {} }) {
  const total = RISK_LEVELS.reduce((sum, item) => sum + (distribution[item.key] || 0), 0)

  return (
    <section className="admin-panel" aria-labelledby="admin-risk-title">
      <div className="admin-panel-heading">
        <div><p className="eyebrow">Current active cases</p><h3 id="admin-risk-title">Risk distribution</h3></div>
        <span>{displayCount(total)} assessed</span>
      </div>
      <div className="admin-risk-track" role="img" aria-label={RISK_LEVELS.map((item) => `${item.label}: ${distribution[item.key] || 0}`).join(', ')}>
        {RISK_LEVELS.map((item) => (
          <span
            key={item.key}
            className={`admin-risk-segment risk-${item.className}`}
            style={{ width: `${total ? ((distribution[item.key] || 0) / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <ul className="admin-risk-legend">
        {RISK_LEVELS.map((item) => (
          <li key={item.key}>
            <span className={`admin-risk-dot risk-${item.className}`} />
            <span>{item.label}</span>
            <strong>{displayCount(distribution[item.key] || 0)}</strong>
          </li>
        ))}
      </ul>
      <p className="admin-panel-note">Latest available preliminary assessment per active patient. AI results support review; they are not a diagnosis.</p>
    </section>
  )
}

function AnalyticsPanel({ title, eyebrow, items }) {
  return (
    <section className="admin-panel" aria-label={title}>
      <div className="admin-panel-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>
      <div className="admin-analytics-list">
        {items.map((item) => (
          <div className="admin-analytics-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{displayCount(item.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function AdminOverview({ analytics }) {
  const summary = analytics?.summary || {}
  const sync = analytics?.sync || {}
  const referrals = analytics?.referrals || {}
  const successRate = summary.syncSuccessRate === null || summary.syncSuccessRate === undefined
    ? '—'
    : `${summary.syncSuccessRate}%`
  const lastReport = sync.lastReportedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sync.lastReportedAt))
    : 'No device reports yet'

  return (
    <>
      <section className="admin-metrics" aria-label="Dashboard statistics">
        <MetricCard label="Total ASHA workers" value={displayCount(summary.ashaWorkers)} />
        <MetricCard label="Total doctors" value={displayCount(summary.doctors)} />
        <MetricCard label="Total patients" value={displayCount(summary.totalPatients)} />
        <MetricCard label="Active cases" value={displayCount(summary.activeCases)} />
        <MetricCard label="High-risk cases" value={displayCount(summary.highRiskCases)} tone="metric-high" />
        <MetricCard label="Critical cases" value={displayCount(summary.criticalCases)} tone="metric-critical" />
        <MetricCard label="Total referrals" value={displayCount(summary.totalReferrals)} />
        <MetricCard label="Pending approvals" value={displayCount(summary.pendingApprovals)} />
        <MetricCard label="Sync success rate" value={successRate} detail={`Last ${sync.windowDays || 30} days`} />
      </section>

      <div className="admin-analytics-grid">
        <RiskDistribution distribution={analytics?.riskDistribution} />
        <AnalyticsPanel
          title="Referral activity"
          eyebrow="Referral analytics"
          items={[
            { label: 'Active referrals', value: referrals.active },
            { label: 'Completed / used', value: referrals.used },
            { label: 'Expired', value: referrals.expired },
          ]}
        />
        <AnalyticsPanel
          title="Synchronization"
          eyebrow={`Last ${sync.windowDays || 30} days`}
          items={[
            { label: 'Successful syncs', value: sync.successful },
            { label: 'Failed syncs', value: sync.failed },
            { label: 'Open conflicts', value: sync.conflicts },
            { label: 'Pending operations (last reported)', value: sync.pendingOperations },
          ]}
        />
      </div>
      <p className="admin-data-note">
        Pending counts are last reported by ASHA devices. {sync.staleDevices ? `${sync.staleDevices} device report(s) are older than ${sync.staleAfterHours} hours. ` : ''}
        Last device report: {lastReport}. Offline devices may not have reported their latest queue. Sync totals include requests recorded by the server and cannot include attempts that never reached it.
      </p>
    </>
  )
}
