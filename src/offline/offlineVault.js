import { offlineDb } from './db.js'
import {
  createOfflineVault,
  decryptVaultValue,
  deriveOfflineKey,
  hasUnlockedOfflineVault,
  lockOfflineVault,
  verifyAndUnlockVault,
} from './offlineVaultCrypto.js'

const PROTECTED_TABLES = ['patients', 'visits', 'syncQueue', 'syncHistory', 'session']
const VERIFIER_VERSION = 1
const encoder = new TextEncoder()

export function isOfflineVaultUnlocked(userId) {
  return hasUnlockedOfflineVault(userId)
}

export function lockOfflineData() {
  lockOfflineVault()
}

async function migrateLegacyRows(userId, vault) {
  if (vault.dataVersion >= VERIFIER_VERSION) return
  let otherAccountPlaintextExists = false
  for (const tableName of PROTECTED_TABLES) {
    const table = offlineDb.table(tableName)
    const rows = await table.toArray()
    const protectedRows = rows.filter((row) => (
      tableName !== 'session' || row.key.startsWith('doctor-follow-ups:')
    ))
    for (const row of protectedRows) {
      const rowOwner = row.workerId || (tableName === 'session' ? /^doctor-follow-ups:([^:]+):/.exec(row.key || '')?.[1] : null)
      if (rowOwner !== userId && !row.__fieldsyncEncrypted) otherAccountPlaintextExists = true
    }
    const ownedRows = rows.filter((row) => (
      (row.workerId || (tableName === 'session' ? /^doctor-follow-ups:([^:]+):/.exec(row.key || '')?.[1] : null)) === userId
      && !row.__fieldsyncEncrypted
      && (tableName !== 'session' || row.key.startsWith('doctor-follow-ups:'))
    ))
    if (ownedRows.length) await table.bulkPut(ownedRows)
  }
  if (otherAccountPlaintextExists) {
    throw new Error('Legacy offline records for another or unidentified ASHA account are still unencrypted. Sign in online with each account on this device to migrate them.')
  }
  await offlineDb.vaults.update(userId, { dataVersion: VERIFIER_VERSION, migratedAt: new Date().toISOString() })
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
