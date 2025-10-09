// Megabonk save file encoder/decoder
// Format: AES-256-CBC encrypted JSON with Base64 encoding

/**
 * Encryption configuration for Megabonk saves
 */
export interface EncryptionConfig {
  keyHex: string // 32 bytes (64 hex chars)
  ivHex: string // 16 bytes (32 hex chars)
}

/**
 * Default encryption keys extracted from game files
 */
export const DEFAULT_CONFIG: EncryptionConfig = {
  keyHex: "d940840d5ae7c7907b092437bc0c5b44aaf70e273e12d0fb4da2b8c767cc911d",
  ivHex: "37864ef15c24bc0acbc60e3978ef1f06",
}

/**
 * Megabonk save data structure
 */
export interface MegabonkSave {
  gold: number
  silver: number
  shopItems: Record<string, number>
  characterProgression: Record<
    string,
    {
      xp: number
      numRuns: number
    }
  >
  achievements: string[]
  claimedAchievements: string[]
  purchases: string[]
  inactivated: string[]
  hasNewQuestDone: boolean
  menuMeta: {
    lastSelectedMap: string
    mapsProgress: Record<string, unknown>
    hasVisitedUnlocks: boolean
    hasVisitedQuests: boolean
    hasVisitedShop: boolean
  }
  newUnlockables: string[]
  newShopItems: string[]
  newMaps: string[]
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to Base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.trim())
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Decrypt a save file using AES-256-CBC
 */
export async function decryptSave(encryptedBase64: string, config: EncryptionConfig = DEFAULT_CONFIG): Promise<string> {
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(config.keyHex), { name: "AES-CBC" }, false, ["decrypt"])

    const iv = hexToBytes(config.ivHex)
    const ciphertext = base64ToBytes(encryptedBase64)

    const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext)

    const decoder = new TextDecoder()
    const plaintext = decoder.decode(decrypted)

    if (!plaintext) {
      throw new Error("Decryption produced empty text. Wrong key/iv?")
    }

    return plaintext
  } catch (e) {
    throw new Error(`Failed to decrypt: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Encrypt plaintext using AES-256-CBC
 */
export async function encryptSave(plaintext: string, config: EncryptionConfig = DEFAULT_CONFIG): Promise<string> {
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(config.keyHex), { name: "AES-CBC" }, false, ["encrypt"])

    const iv = hexToBytes(config.ivHex)
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data)

    return bytesToBase64(new Uint8Array(encrypted))
  } catch (e) {
    throw new Error(`Failed to encrypt: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Decode a save file from a File object
 */
export async function decodeSaveFromFile(file: File): Promise<MegabonkSave> {
  const encryptedText = await file.text()
  const decrypted = await decryptSave(encryptedText)

  try {
    return JSON.parse(decrypted) as MegabonkSave
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Encode save data to a Blob
 */
export async function encodeSaveToBlob(data: MegabonkSave): Promise<Blob> {
  const json = JSON.stringify(data)
  const encrypted = await encryptSave(json)
  return new Blob([encrypted], { type: "text/plain" })
}
