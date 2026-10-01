import { offlineDb } from './db.js'
import {
  createOfflineVault,
  decryptVaultValue,
  deriveOfflineKey,
  hasLegacyOfflinePatch,
  hasUnlockedOfflineVault,
  lockOfflineVault,
  stripLegacyOfflinePatchMarker,
  verifyAndUnlockVault,
} from './offlineVaultCrypto.js'

const PROTECTED_TABLES = ['patients', 'visits', 'syncQueue', 'syncHistory', 'session']
const OFFLINE_DATA_VERSION = 2
const encoder = new TextEncoder()

function sessionVaultOwner(row) {
  return /^(?:doctor-follow-ups|dashboard):([^:]+)(?::|$)/.exec(row?.key || '')?.[1] || null
}

function isVaultSessionRow(row) {
  return /^(?:doctor-follow-ups|dashboard):/.test(row?.key || '')
}

export function isOfflineVaultUnlocked(userId) {
  return hasUnlockedOfflineVault(userId)
}

export function lockOfflineData() {
  lockOfflineVault()
}

async function migrateLegacyRows(userId, vault) {
  if (vault.dataVersion >= OFFLINE_DATA_VERSION) return
  let otherAccountPlaintextExists = false
  for (const tableName of PROTECTED_TABLES) {
    const table = offlineDb.table(tableName)
    const rows = await table.toArray()
    const protectedRows = rows.filter((row) => (
      tableName !== 'session' || isVaultSessionRow(row)
    ))
    for (const row of protectedRows) {
      const rowOwner = row.workerId || (tableName === 'session' ? sessionVaultOwner(row) : null)
      if (rowOwner !== userId && !row.__fieldsyncEncrypted) otherAccountPlaintextExists = true
    }
    const ownedRows = rows.filter((row) => (
      (row.workerId || (tableName === 'session' ? sessionVaultOwner(row) : null)) === userId
      && !row.__fieldsyncEncrypted
      && (tableName !== 'session' || isVaultSessionRow(row))
    ))
    if (ownedRows.length) await table.bulkPut(ownedRows)
    const rowsToUpgrade = rows.filter((row) => (
      (row.workerId || (tableName === 'session' ? sessionVaultOwner(row) : null)) === userId
      && (
        hasLegacyOfflinePatch(row)
        || (tableName === 'syncQueue' && row.attemptedAt === undefined)
      )
    ))
    for (const row of rowsToUpgrade) {
      const upgraded = stripLegacyOfflinePatchMarker(row)
      if (tableName === 'syncQueue' && upgraded.attemptedAt === undefined) {
        // Older rows may already have reached the server before their response
        // was lost. Keep their payload and operation ID immutable on retry.
        upgraded.attemptedAt = upgraded.createdAt || new Date().toISOString()
      }
      await table.put(upgraded)
    }
  }
  if (otherAccountPlaintextExists) {
    throw new Error('Legacy offline records for another or unidentified ASHA account are still unencrypted. Sign in online with each account on this device to migrate them.')
  }
  await offlineDb.vaults.update(userId, { dataVersion: OFFLINE_DATA_VERSION, migratedAt: new Date().toISOString() })
}

export async function initializeOrUnlockOfflineVault(user, password) {
  await offlineDb.open()
  let vault = await offlineDb.vaults.get(user.id)
  if (!vault) {
    await createOfflineVault({ user, password, vaultStore: offlineDb.vaults })
    vault = await offlineDb.vaults.get(user.id)
  } else {
    await verifyAndUnlockVault({ userId: user.id, password, vault })
  }
  await migrateLegacyRows(user.id, vault)
}

export async function unlockOfflineData(userId, password) {
  await offlineDb.open()
  const vault = await offlineDb.vaults.get(userId)
  if (!vault) throw new Error('This device has no offline vault for the account yet. Sign in while online once to prepare offline access.')
  const claims = await verifyAndUnlockVault({ userId, password, vault })
  await migrateLegacyRows(userId, vault)
  return claims
}

export async function hasOfflineVault(userId) {
  await offlineDb.open()
  return Boolean(await offlineDb.vaults.get(userId))
}

export { decryptVaultValue, deriveOfflineKey, encoder }
