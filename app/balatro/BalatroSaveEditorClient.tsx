"use client"
import { useState } from "react"
import { Sparkles, Code } from "lucide-react"
import { decodeSaveFromFile, encodeSaveToBlob, type DecodedSave } from "@/lib/balatro/decoder"
import { downloadJSON } from "@/lib/download-json"
import { track } from "@vercel/analytics"
import gamesData from "@/data/games.json"
import { AllItems } from "@/lib/balatro/game-data"
import type { MetaFileData, ProfileFileData } from "@/lib/balatro/types"

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current: unknown = obj

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".")
  const newObj = structuredClone(obj)
  let current: Record<string, unknown> = newObj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
  return newObj
}

export default function BalatroSaveEditorClient() {
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [metaSearch, setMetaSearch] = useState("")
  const [selectedStake, setSelectedStake] = useState<number>(-1)
  const [jokerSearch, setJokerSearch] = useState("")

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      console.log("[v0] Decoded save data:", decoded)
      setSaveData(decoded)
      setOriginalFile(file)

      track("file_uploaded", {
        game: "Balatro",
        fileSize: file.size,
        fileName: file.name,
      })
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Balatro save file (.jkr)")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const blob = await encodeSaveToBlob(saveData, originalFile.name)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = originalFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      track("file_downloaded", {
        game: "Balatro",
        fileName: originalFile.name,
        editedFileName: originalFile.name,
      })
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const updateValue = (path: string, value: string | number) => {
    if (!saveData) return
    const numValue = typeof value === "string" ? Number.parseInt(value) || 0 : value
    setSaveData(setNestedValue(saveData as Record<string, unknown>, path, numValue) as DecodedSave)
  }

  const updateStringValue = (path: string, value: string) => {
    if (!saveData) return
    setSaveData(setNestedValue(saveData as Record<string, unknown>, path, value) as DecodedSave)
  }

  const gameData = gamesData.games.find((game) => game.id === "balatro")

  const isProfileFile = originalFile?.name.toLowerCase().includes("profile") ?? false
  const isMetaFile = originalFile?.name.toLowerCase().includes("meta") ?? false

  const profileData = saveData as unknown as ProfileFileData
  const metaData = saveData as unknown as MetaFileData

  const quickStats = saveData
    ? isProfileFile
      ? [
          {
            label: "Profile Name",
            value: profileData?.name || "Unknown",
            icon: <Sparkles className="w-4 h-4 text-primary" />,
          },
          {
            label: "Total Wins",
            value: profileData?.career_stats?.c_wins || 0,
            icon: <Sparkles className="w-4 h-4 text-primary" />,
          },
        ]
      : isMetaFile
        ? [
            {
              label: "Discovered Items",
              value: metaData?.discovered ? Object.values(metaData.discovered).filter((v) => v === true).length : 0,
              icon: <Sparkles className="w-4 h-4 text-primary" />,
            },
            {
              label: "Total Items",
              value: metaData?.discovered ? Object.keys(metaData.discovered).length : 0,
              icon: <Sparkles className="w-4 h-4 text-primary" />,
            },
          ]
        : []
    : []

  const unlockAllItems = () => {
    if (!metaData) return
    const newData = structuredClone(saveData) as Record<string, unknown>
    const newDiscovered: Record<string, boolean> = { ...metaData.discovered }
    const newUnlocked: Record<string, boolean> = { ...metaData.unlocked }

    // Unlock all items from the game data
    Object.keys(AllItems).forEach((key) => {
      newDiscovered[key] = true
      newUnlocked[key] = true
    })

    newData.discovered = newDiscovered
    newData.unlocked = newUnlocked
    setSaveData(newData as DecodedSave)
  }

  const quickActions = saveData
    ? [
        ...(isMetaFile
          ? [
              {
                label: "Unlock Everything",
                onClick: unlockAllItems,
                icon: <Sparkles className="w-4 h-4 mr-2" />,
              },
            ]
          : []),
        {
          label: "Download JSON",
          onClick: () => {
            const filename = originalFile?.name.replace(/\.[^/.]+$/, "") || "balatro-save"
            downloadJSON(saveData, filename)
            track("json_downloaded", {
              game: "Balatro",
              fileName: originalFile?.name,
            })
          },
          icon: <Code className="w-4 h-4 mr-2" />,
        },
      ]
    : []

  return <main className="min-h-screen bg-background pb-20"></main>
}
