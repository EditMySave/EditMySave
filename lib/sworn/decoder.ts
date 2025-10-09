export interface SwornSave {
  fileHeader: number
  segments: Array<{
    index: number
    category: string
    text: string
    value: number | null
  }>
}

function decodeNibbles(bytes: number[]): string {
  return bytes
    .map((byte) => {
      const highNibble = (byte >> 4) & 0x0f
      if (highNibble === 0) return " "
      if (highNibble >= 1 && highNibble <= 15) return String.fromCharCode(96 + highNibble) // a-o
      return "?"
    })
    .join("")
}

function decodeNumber(bytes: number[]): number {
  const digits = bytes.map((b) => (b >> 4) & 0x0f)
  return Number.parseInt(digits.join(""))
}

function encodeNumber(num: number): number[] {
  const digits = num
    .toString()
    .split("")
    .map((d) => Number.parseInt(d))
  return digits.map((digit) => (digit << 4) | 0x3)
}

function categorizeSegment(text: string): string {
  if (text.startsWith("accolade")) return "achievement"
  if (text.startsWith("codehn")) return "code"
  if (text.startsWith("meda")) return "medal"
  if (text.startsWith(" laieb")) return "player"
  if (text.startsWith(" ebchace")) return "purchase"
  if (text.includes("dialog")) return "dialog"
  if (text.includes("loadoedn")) return "save_state"
  if (text.startsWith("dbackedc")) return "tracked"
  if (text.startsWith("biome")) return "biome"
  if (text === "dada") return "currency"
  if (text === "febcion") return "metadata"
  if (text === "") return "separator"
  return "other"
}

export async function decodeSaveFromFile(file: File): Promise<SwornSave> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = Array.from(new Uint8Array(arrayBuffer))

  const decoded: SwornSave = {
    fileHeader: bytes[0],
    segments: [],
  }

  let pos = 1
  let segmentIndex = 0

  while (pos < bytes.length - 1) {
    if (bytes[pos] === 0xd0 && bytes[pos + 1] === 0xa0) {
      pos += 2

      while (pos < bytes.length && bytes[pos] === 0x02) pos++

      let contentBytes: number[] = []
      if (pos < bytes.length && bytes[pos] === 0x22) {
        pos++
        const contentStart = pos
        while (pos < bytes.length && bytes[pos] !== 0x22) pos++
        contentBytes = bytes.slice(contentStart, pos)
        pos++
      }

      const endMarkerStart = pos
      const nextDelim = bytes.findIndex((b, i) => i > pos && b === 0xd0 && bytes[i + 1] === 0xa0)
      const endMarkerEnd = nextDelim !== -1 ? nextDelim : bytes.length
      const endMarker = bytes.slice(endMarkerStart, endMarkerEnd)

      const text = decodeNibbles(contentBytes)

      let value: number | null = null
      if (endMarker.length >= 3) {
        const c2Index = endMarker.indexOf(0xc2)
        if (c2Index > 2) {
          const numberBytes = endMarker.slice(2, c2Index)
          const allDigits = numberBytes.every((b) => {
            const highNibble = (b >> 4) & 0x0f
            return highNibble >= 0 && highNibble <= 9
          })
          if (allDigits && numberBytes.length > 0) {
            value = decodeNumber(numberBytes)
          }
        }
      }

      const category = categorizeSegment(text)

      decoded.segments.push({
        index: segmentIndex,
        category,
        text,
        value,
      })

      segmentIndex++
      pos = endMarkerEnd
    } else {
      pos++
    }
  }

  return decoded
}

export async function encodeSaveToBlob(editedJson: SwornSave, originalFile: File): Promise<Blob> {
  const originalArrayBuffer = await originalFile.arrayBuffer()
  const bytes = Array.from(new Uint8Array(originalArrayBuffer))

  const valueOffsets = new Map<number, { offset: number; length: number; originalValue: number }>()

  let pos = 1
  let segmentIndex = 0

  while (pos < bytes.length - 1) {
    if (bytes[pos] === 0xd0 && bytes[pos + 1] === 0xa0) {
      pos += 2
      while (pos < bytes.length && bytes[pos] === 0x02) pos++

      if (pos < bytes.length && bytes[pos] === 0x22) {
        pos++
        while (pos < bytes.length && bytes[pos] !== 0x22) pos++
        if (pos < bytes.length) pos++
      }

      if (bytes[pos] === 0xa3 && bytes[pos + 1] === 0x02) {
        const valueStart = pos + 2
        const c2Offset = bytes.findIndex((b, i) => i >= valueStart && b === 0xc2)

        if (c2Offset !== -1 && c2Offset > valueStart) {
          const valueBytes = bytes.slice(valueStart, c2Offset)
          const value = decodeNumber(valueBytes)

          valueOffsets.set(segmentIndex, {
            offset: valueStart,
            length: valueBytes.length,
            originalValue: value,
          })
        }
      }

      const nextDelim = bytes.findIndex((b, i) => i > pos && b === 0xd0 && bytes[i + 1] === 0xa0)
      pos = nextDelim !== -1 ? nextDelim : bytes.length
      segmentIndex++
    } else {
      pos++
    }
  }

  const changes: Array<{ offset: number; oldLength: number; newBytes: number[] }> = []

  for (const editedSeg of editedJson.segments) {
    const offsetInfo = valueOffsets.get(editedSeg.index)

    if (offsetInfo && editedSeg.value !== null && editedSeg.value !== offsetInfo.originalValue) {
      const newBytes = encodeNumber(editedSeg.value)
      changes.push({
        offset: offsetInfo.offset,
        oldLength: offsetInfo.length,
        newBytes,
      })
    }
  }

  changes.sort((a, b) => b.offset - a.offset)

  for (const change of changes) {
    bytes.splice(change.offset, change.oldLength, ...change.newBytes)
  }

  return new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" })
}
