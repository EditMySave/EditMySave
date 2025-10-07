"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, Download, Sparkles, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeSaveFromFile, encodeSaveToBlob, type DecodedSave } from "@/lib/save-decoder"
import Link from "next/link"

interface CurrencyValues {
  fairyEmbers: number
  silk: number
  moonstone: number
  grailWater: number
  crystalShards: number
}

const CURRENCY_IDENTIFIERS = {
  crystalShards: "medaocebbencincbicdalchabd", // index 231
  fairyEmbers: "medaocebbencinfaibiembeb", // index 234
  grailWater: "medaocebbencingbailgadeb", // index 236
  moonstone: "medaocebbencinmooncdone", // index 238
  silk: "medaocebbencincilk", // index 240
}

export default function SwornSaveEditor() {
  const [isDragging, setIsDragging] = useState(false)
  const [saveData, setSaveData] = useState<DecodedSave | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [currencies, setCurrencies] = useState<CurrencyValues>({
    fairyEmbers: 0,
    silk: 0,
    moonstone: 0,
    grailWater: 0,
    crystalShards: 0,
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processSaveFile = async (file: File) => {
    setIsProcessing(true)
    try {
      const decoded = await decodeSaveFromFile(file)
      setSaveData(decoded)
      setOriginalFile(file)

      const newCurrencies = { ...currencies }

      decoded.segments.forEach((segment, index) => {
        if (segment.category === "medal" && segment.value !== null) {
          // Match by segment identifier
          if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
            newCurrencies.crystalShards = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
            newCurrencies.fairyEmbers = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
            newCurrencies.grailWater = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
            newCurrencies.moonstone = segment.value
          } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
            newCurrencies.silk = segment.value
          }
        }
      })

      setCurrencies(newCurrencies)
    } catch (error) {
      console.error("Error processing save file:", error)
      alert("Failed to process save file. Please ensure it is a valid Sworn save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processSaveFile(files[0])
    }
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processSaveFile(files[0])
    }
  }

  const handleCurrencyChange = (key: keyof CurrencyValues, value: string) => {
    const numValue = Number.parseInt(value) || 0
    setCurrencies((prev) => ({ ...prev, [key]: numValue }))
  }

  const handleDownload = async () => {
    if (!saveData || !originalFile) return

    setIsProcessing(true)
    try {
      const updatedSave = { ...saveData }
      updatedSave.segments = updatedSave.segments.map((segment, index) => {
        if (segment.category === "medal") {
          if (segment.text === CURRENCY_IDENTIFIERS.crystalShards) {
            return { ...segment, value: currencies.crystalShards }
          } else if (segment.text === CURRENCY_IDENTIFIERS.fairyEmbers) {
            return { ...segment, value: currencies.fairyEmbers }
          } else if (segment.text === CURRENCY_IDENTIFIERS.grailWater) {
            return { ...segment, value: currencies.grailWater }
          } else if (segment.text === CURRENCY_IDENTIFIERS.moonstone) {
            return { ...segment, value: currencies.moonstone }
          } else if (segment.text === CURRENCY_IDENTIFIERS.silk) {
            return { ...segment, value: currencies.silk }
          }
        }
        return segment
      })

      const blob = await encodeSaveToBlob(updatedSave, originalFile)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${originalFile.name.replace(/\.[^/.]+$/, "")}_edited.dat`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error encoding save file:", error)
      alert("Failed to create edited save file.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex justify-start">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-balance">Sworn Save Editor</h1>
          </div>
          <p className="text-muted-foreground text-pretty">Edit your game currencies safely and easily</p>
        </div>

        {!saveData ? (
          <>
            <Card className="border-border bg-muted/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground text-center">
                  <span className="font-medium text-foreground">Windows save location:</span>{" "}
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    C:\Users\[USERNAME]\AppData\LocalLow\Windwalk Games\SWORN\data\[STEAM_ID]
                  </code>
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-border">
              <CardContent className="pt-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-4 p-12 rounded-lg transition-colors ${
                    isDragging ? "bg-accent" : "bg-card"
                  }`}
                >
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">Drop your save file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    onChange={handleFileInput}
                    accept=".sav,.save"
                  />
                  <Button asChild variant="secondary">
                    <label htmlFor="file-input" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-4">
              <Card className="hover:border-primary/50 transition-colors w-full md:w-[280px]">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img src="/images/fairyembers.png" alt="Fairy Embers" className="w-full h-full object-contain" />
                    </div>
                    <Label htmlFor="fairy-embers" className="text-lg font-semibold">
                      Fairy Embers
                    </Label>
                  </div>
                  <Input
                    id="fairy-embers"
                    type="number"
                    value={currencies.fairyEmbers}
                    onChange={(e) => handleCurrencyChange("fairyEmbers", e.target.value)}
                    min="0"
                    className="font-mono text-center text-lg"
                  />
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors w-full md:w-[280px]">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img src="/images/silk.png" alt="Silk" className="w-full h-full object-contain" />
                    </div>
                    <Label htmlFor="silk" className="text-lg font-semibold">
                      Silk
                    </Label>
                  </div>
                  <Input
                    id="silk"
                    type="number"
                    value={currencies.silk}
                    onChange={(e) => handleCurrencyChange("silk", e.target.value)}
                    min="0"
                    className="font-mono text-center text-lg"
                  />
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors w-full md:w-[280px]">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img src="/images/moonstone.png" alt="Moonstone" className="w-full h-full object-contain" />
                    </div>
                    <Label htmlFor="moonstone" className="text-lg font-semibold">
                      Moonstone
                    </Label>
                  </div>
                  <Input
                    id="moonstone"
                    type="number"
                    value={currencies.moonstone}
                    onChange={(e) => handleCurrencyChange("moonstone", e.target.value)}
                    min="0"
                    className="font-mono text-center text-lg"
                  />
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors w-full md:w-[280px]">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img src="/images/grailwater.png" alt="Grail Water" className="w-full h-full object-contain" />
                    </div>
                    <Label htmlFor="grail-water" className="text-lg font-semibold">
                      Grail Water
                    </Label>
                  </div>
                  <Input
                    id="grail-water"
                    type="number"
                    value={currencies.grailWater}
                    onChange={(e) => handleCurrencyChange("grailWater", e.target.value)}
                    min="0"
                    className="font-mono text-center text-lg"
                  />
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors w-full md:w-[280px]">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 flex items-center justify-center">
                      <img
                        src="/images/crystalshards.png"
                        alt="Crystal Shards"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <Label htmlFor="crystal-shards" className="text-lg font-semibold">
                      Crystal Shards
                    </Label>
                  </div>
                  <Input
                    id="crystal-shards"
                    type="number"
                    value={currencies.crystalShards}
                    onChange={(e) => handleCurrencyChange("crystalShards", e.target.value)}
                    min="0"
                    className="font-mono text-center text-lg"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleDownload} disabled={isProcessing} className="flex-1" size="lg">
                <Download className="w-4 h-4 mr-2" />
                {isProcessing ? "Processing..." : "Download Edited Save"}
              </Button>
              <Button
                onClick={() => {
                  setSaveData(null)
                  setOriginalFile(null)
                }}
                variant="outline"
                size="lg"
              >
                Load New File
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              All processing of save files is happening locally in your browser.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
