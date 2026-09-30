const PATIENT_GENDERS = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']
const VITAL_RANGES = {
  temperatureC: [25, 45],
  heartRateBpm: [20, 250],
  respiratoryRatePerMinute: [4, 80],
  systolicMmHg: [40, 300],
  diastolicMmHg: [20, 200],
  oxygenSaturationPercent: [50, 100],
  weightKg: [0.3, 500],
  heightCm: [20, 250],
}

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dateKey(value, label, { allowFuture = true } = {}) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`)
  const key = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (!allowFuture && key > todayKey()) throw new Error(`${label} cannot be in the future`)
  return value
}

function normalizeList(value, label, maxItems, maxLength) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must have at most ${maxItems} items`)
  return value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > maxLength) {
      throw new Error(`${label} item ${index + 1} is invalid`)
    }
    return item.trim()
  })
}

export function normalizePatientForOffline(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Patient details are required')
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : ''
  if (fullName.length < 2 || fullName.length > 120) throw new Error('Full name must be between 2 and 120 characters')
  if (!PATIENT_GENDERS.includes(input.gender)) throw new Error('Select a valid gender')
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (phone.length > 25 || (phone && !/^\+?[0-9().\s-]{5,25}$/.test(phone))) throw new Error('Enter a valid phone number')
  const address = input.address || {}
  if (!address || typeof address !== 'object' || Array.isArray(address)) throw new Error('Address must be an object')
  const normalizedAddress = {}
  for (const [field, maximum] of Object.entries({ village: 120, district: 120, state: 120, details: 300 })) {
    const value = address[field] || ''
    if (typeof value !== 'string' || value.trim().length > maximum) throw new Error(`${field} is too long`)
    normalizedAddress[field] = value.trim()
  }
  return {
    fullName,
    dateOfBirth: dateKey(input.dateOfBirth, 'Date of birth', { allowFuture: false }),
    gender: input.gender,
    phone,
    address: normalizedAddress,
  }
}

export function normalizeVisitForOffline(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Visit details are required')
  const visitType = input.visitType || 'INITIAL'
  if (!['INITIAL', 'FOLLOW_UP'].includes(visitType)) throw new Error('Select a valid visit type')
  const chiefComplaint = typeof input.symptoms?.chiefComplaint === 'string' ? input.symptoms.chiefComplaint.trim() : ''
  if (chiefComplaint.length < 2 || chiefComplaint.length > 1000) throw new Error('Chief complaint must be between 2 and 1000 characters')
  const details = input.symptoms?.details || ''
  if (typeof details !== 'string' || details.length > 4000) throw new Error('Symptom details are too long')
  const rawDuration = input.symptoms?.durationDays
  const durationDays = rawDuration === undefined || rawDuration === null || rawDuration === '' ? null : Number(rawDuration)
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 0 || durationDays > 365)) {
    throw new Error('Symptom duration must be a whole number from 0 to 365 days')
  }
  const visitDate = dateKey(input.visitDate || new Date().toISOString(), 'Visit date', { allowFuture: false })
  const followUpDate = dateKey(input.followUp?.date ?? input.followUpDate, 'Follow-up date')
  const followUpOf = input.followUpOf || null
  const rawFollowUpConsultationId = input.followUpConsultationId || input.followUpConsultation || null
  const followUpConsultationId = rawFollowUpConsultationId && typeof rawFollowUpConsultationId === 'object'
    ? rawFollowUpConsultationId._id?.toString() || rawFollowUpConsultationId.toString?.() || null
    : rawFollowUpConsultationId
  if (followUpOf && followUpConsultationId) throw new Error('A follow-up must complete one scheduled item')
  if (visitType === 'FOLLOW_UP' && !followUpOf && !followUpConsultationId) throw new Error('Select the scheduled item this follow-up completes')
  if (visitType === 'FOLLOW_UP' && followUpConsultationId && !/^[a-f\d]{24}$/i.test(followUpConsultationId)) throw new Error('Select a valid doctor follow-up')
  if (visitType === 'INITIAL' && (followUpOf || followUpConsultationId)) throw new Error('An initial visit cannot complete another visit')
  const vitalsInput = input.vitals || {}
  if (typeof vitalsInput !== 'object' || Array.isArray(vitalsInput)) throw new Error('Vitals must be an object')
  const vitals = {}
  for (const [field, [minimum, maximum]] of Object.entries(VITAL_RANGES)) {
    const value = vitalsInput[field]
    if (value === undefined || value === null || value === '') {
      vitals[field] = null
      continue
    }
    const number = Number(value)
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      throw new Error(`${field} must be between ${minimum} and ${maximum}`)
    }
    vitals[field] = number
  }
  if (vitals.systolicMmHg !== null && vitals.diastolicMmHg !== null && vitals.diastolicMmHg >= vitals.systolicMmHg) {
    throw new Error('Diastolic blood pressure must be lower than systolic blood pressure')
  }
  const observations = input.observations || ''
  if (typeof observations !== 'string' || observations.length > 4000) throw new Error('Observations are too long')
  return {
    ...input,
    visitType,
    visitDate,
    followUpOf,
    followUpConsultationId,
    symptoms: { chiefComplaint, details: details.trim(), durationDays },
    medicalHistory: normalizeList(input.medicalHistory, 'Medical history', 30, 300),
    allergies: normalizeList(input.allergies, 'Allergies', 30, 200),
    currentMedicines: normalizeList(input.currentMedicines, 'Current medicines', 30, 200),
    vitals,
    observations: observations.trim(),
    followUp: {
      date: followUpDate,
      status: followUpDate ? 'SCHEDULED' : 'NOT_SCHEDULED',
      completedByVisit: null,
    },
  }
}
