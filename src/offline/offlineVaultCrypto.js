const KDF_ITERATIONS = 600_000
const VAULT_FORMAT_VERSION = 1
const ENCRYPTED_FIELD = '__fieldsyncEncrypted'
const LEGACY_PATCH_FIELDS = '__fieldsyncLegacyPatchFields'
const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

const PROTECTED_TABLES = {
  patients: ['localId', 'serverId', 'workerId', 'status', 'syncStatus', 'updatedAt'],
  visits: ['localId', 'serverId', 'patientLocalId', 'workerId', 'syncStatus'],
  syncQueue: ['queueId', 'localId', 'workerId', 'entityType', 'operation', 'syncStatus', 'createdAt', 'retryCount', 'retryable', 'nextRetryAt'],
  syncHistory: ['historyId', 'localId', 'workerId', 'entityType', 'operation', 'syncStatus', 'createdAt', 'syncedAt'],
}

let activeVault = null

export class OfflineVaultLockedError extends Error {
  constructor() {
    super('Unlock offline records with your account password')
    this.name = 'OfflineVaultLockedError'
  }
}

function cryptoProvider() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure browser cryptography is unavailable. Open FieldSync in a supported browser over HTTPS or localhost.')
  }
  return globalThis.crypto
}

function randomBytes(length) {
  return cryptoProvider().getRandomValues(new Uint8Array(length))
}

function protectedMetadata(tableName, record) {
  const fields = PROTECTED_TABLES[tableName]
  if (fields) return fields
  if (tableName === 'session' && typeof record?.key === 'string' && /^(doctor-follow-ups|dashboard):/.test(record.key)) {
    return ['key', 'workerId']
  }
  return null
}

function sessionWorkerId(record) {
  if (record?.workerId) return record.workerId
  const match = /^(?:doctor-follow-ups|dashboard):([^:]+)(?::|$)/.exec(record?.key || '')
  return match?.[1] || null
}

function userForRecord(tableName, record) {
  return tableName === 'session' ? sessionWorkerId(record) : record?.workerId || null
}

function recordIdentity(record) {
  return String(record?.localId || record?.key || `${record?.entityType || ''}:${record?.operation || ''}:${record?.createdAt || ''}:${record?.syncStatus || ''}`)
}

function associatedData(tableName, workerId, record) {
  return TEXT_ENCODER.encode(`fieldsync-offline-v1:${tableName}:${workerId}:${recordIdentity(record)}`)
}

function metadataOnly(tableName, record) {
  const fields = protectedMetadata(tableName, record)
  if (!fields) return record
  const result = {}
  for (const field of fields) {
    if (record[field] !== undefined) result[field] = record[field]
  }
  if (record[ENCRYPTED_FIELD]) result[ENCRYPTED_FIELD] = true
  return result
}

function requireActiveKey(workerId) {
  if (!activeVault || !workerId || activeVault.userId !== workerId) throw new OfflineVaultLockedError()
  return activeVault.key
}

export function hasUnlockedOfflineVault(userId) {
  return Boolean(activeVault && (!userId || activeVault.userId === userId))
}

export function lockOfflineVault() {
  activeVault = null
}

export async function deriveOfflineKey(password, salt) {
  const crypto = cryptoProvider()
  const passwordKey = await crypto.subtle.importKey('raw', TEXT_ENCODER.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptVaultValue(key, value, additionalData) {
  const iv = randomBytes(12)
  const ciphertext = await cryptoProvider().subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    key,
    TEXT_ENCODER.encode(JSON.stringify(value)),
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptVaultValue(key, encrypted, additionalData) {
  const plaintext = await cryptoProvider().subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv, additionalData, tagLength: 128 },
    key,
    encrypted.ciphertext,
  )
  return JSON.parse(TEXT_DECODER.decode(plaintext))
}

export async function verifyAndUnlockVault({ userId, password, vault }) {
  lockOfflineVault()
  const key = await deriveOfflineKey(password, vault.salt)
  let claims
  try {
    claims = await decryptVaultValue(key, vault.verifier, TEXT_ENCODER.encode(`fieldsync-vault-verifier-v1:${userId}`))
  } catch {
    throw new Error('Offline records could not be unlocked with that password')
  }
  if (claims.version !== VAULT_FORMAT_VERSION || claims.userId !== userId) {
    throw new Error('Offline records could not be unlocked with that password')
  }
  activeVault = { userId, key }
  return claims
}

export async function createOfflineVault({ user, password, vaultStore }) {
  const salt = randomBytes(16)
  const key = await deriveOfflineKey(password, salt)
  const claims = {
    version: VAULT_FORMAT_VERSION,
    userId: user.id,
    role: user.role,
    status: user.status,
    email: user.email,
  }
  const verifier = await encryptVaultValue(key, claims, TEXT_ENCODER.encode(`fieldsync-vault-verifier-v1:${user.id}`))
  const vault = { userId: user.id, salt, verifier, dataVersion: 0, createdAt: new Date().toISOString() }
  await vaultStore.add(vault)
  activeVault = { userId: user.id, key }
  return claims
}

export async function encryptOfflineRecord(tableName, record) {
  const metadataFields = protectedMetadata(tableName, record)
  if (!metadataFields) return record
  const workerId = userForRecord(tableName, record)
  const key = requireActiveKey(workerId)
  const metadata = {}
  const payload = {}
  const metadataSet = new Set([...metadataFields, ENCRYPTED_FIELD])
  for (const [field, value] of Object.entries(record)) {
    if (metadataSet.has(field)) continue
    payload[field] = value
  }
  const encrypted = await encryptVaultValue(key, payload, associatedData(tableName, workerId, record))
  for (const field of metadataFields) {
    if (record[field] !== undefined) metadata[field] = record[field]
  }
  return { ...metadata, [ENCRYPTED_FIELD]: { version: VAULT_FORMAT_VERSION, ...encrypted } }
}

export async function decryptOfflineRecord(tableName, record) {
  if (!record) return record
  const metadataFields = protectedMetadata(tableName, record)
  if (!metadataFields) return record
  const workerId = userForRecord(tableName, record)
  if (!activeVault || activeVault.userId !== workerId) return metadataOnly(tableName, record)

  const envelope = record[ENCRYPTED_FIELD]
  if (!envelope) return record // Legacy plaintext records are available only to their owner for migration.
  if (envelope.version !== VAULT_FORMAT_VERSION) throw new Error('Unsupported encrypted offline record version')
  const key = requireActiveKey(workerId)
  const payload = await decryptVaultValue(key, envelope, associatedData(tableName, workerId, record))
  const metadata = new Set([...metadataFields, ENCRYPTED_FIELD])
  const legacyPatch = Object.fromEntries(Object.entries(record).filter(([field]) => !metadata.has(field)))
  const restored = { ...metadataOnly(tableName, record), ...payload, ...legacyPatch, [ENCRYPTED_FIELD]: true }
  if (Object.keys(legacyPatch).length) restored[LEGACY_PATCH_FIELDS] = Object.keys(legacyPatch)
  return restored
}

export function hasLegacyOfflinePatch(record) {
  return Array.isArray(record?.[LEGACY_PATCH_FIELDS]) && record[LEGACY_PATCH_FIELDS].length > 0
}

export function stripLegacyOfflinePatchMarker(record) {
  const clean = { ...record }
  delete clean[LEGACY_PATCH_FIELDS]
  return clean
}

export function isProtectedOfflineRecord(tableName, record) {
  return Boolean(protectedMetadata(tableName, record))
}

export function offlineVaultMetadataFields(tableName, record) {
  return protectedMetadata(tableName, record) || []
}
