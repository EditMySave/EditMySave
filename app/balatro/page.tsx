"use client"

import type React from "react"
import { useState } from "react"
import { Sparkles, ArrowLeft, Code, Save, Search } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeSaveFromFile, encodeSaveToBlob, type DecodedSave } from "@/lib/balatro/decoder"
import { downloadJSON } from "@/lib/download-json"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { SaveFileUpload } from "@/components/save-file-upload"
import { SaveLocationHelp } from "@/components/save-location-help"
import { EditorSidebar } from "@/components/editor-sidebar"
import gamesData from "@/data/games.json"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonTreeEditor } from "@/components/json-tree-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AllItems, Balatro } from "@/lib/balatro/game-data"
import type { MetaFileData, ProfileFileData } from "@/lib/balatro/types"
import { ChevronLeft, ChevronRight } from 'lucide-react'

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  const newObj = structuredClone(obj)
  let current: Record<string, unknown> = newObj
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  
  current[keys[keys.length - 1]] = value
  return newObj
}

export default function BalatroSaveEditor() {
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

  const isProfileFile = originalFile?.name.toLowerCase().includes('profile') ?? false
  const isMetaFile = originalFile?.name.toLowerCase().includes('meta') ?? false

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
            value: metaData?.discovered ? Object.values(metaData.discovered).filter(v => v === true).length : 0,
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
    Object.keys(AllItems).forEach(key => {
      newDiscovered[key] = true
      newUnlocked[key] = true
    })
    
    newData.discovered = newDiscovered
    newData.unlocked = newUnlocked
    setSaveData(newData as DecodedSave)
  }

  const quickActions = saveData
    ? [
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
        ...(isMetaFile
          ? [
              {
                label: "Unlock Everything",
                onClick: unlockAllItems,
                icon: <Sparkles className="w-4 h-4 mr-2" />,
              },
            ]
          : []),
      ]
    : []

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Balatro</h1>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </Button>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto p-6">
        {!saveData ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-8">
              <h2 className="text-3xl font-bold text-foreground">Balatro Save Editor</h2>
              <p className="text-muted-foreground">Edit your Balatro profile and meta save files</p>
              <p className="text-sm text-muted-foreground">Supports both profile.jkr and meta.jkr files</p>
            </div>

            {gameData && <SaveLocationHelp platforms={gameData.platforms} gameName={gameData.name} />}

            <SaveFileUpload onFileSelect={processSaveFile} acceptedFileTypes=".jkr" isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="flex gap-6 pt-4">
            <EditorSidebar
              onDownload={handleDownload}
              onLoadNew={() => {
                setSaveData(null)
                setOriginalFile(null)
              }}
              isProcessing={isProcessing}
              hasSaveData={!!saveData}
              fileName={originalFile?.name}
              fileSize={originalFile?.size}
              lastModified={originalFile ? new Date() : undefined}
              quickStats={quickStats}
              quickActions={quickActions}
            />

            <div className="flex-1 space-y-4">
              <Tabs defaultValue={isProfileFile ? "profile" : isMetaFile ? "meta" : "raw"} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-card border border-border">
                  {isProfileFile && (
                    <TabsTrigger value="profile" className="data-[state=active]:bg-muted">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Profile
                    </TabsTrigger>
                  )}
                  {isMetaFile && (
                    <TabsTrigger value="meta" className="data-[state=active]:bg-muted">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Meta
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="raw" className="data-[state=active]:bg-muted">
                    <Code className="w-4 h-4 mr-2" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                {isProfileFile && profileData && (
                  <TabsContent value="profile" className="space-y-4 mt-4">
                    {/* Profile Name */}
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Profile</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-name" className="text-sm font-medium text-card-foreground">
                            Profile Name
                          </Label>
                          <Input
                            id="profile-name"
                            type="text"
                            value={profileData?.name || ''}
                            onChange={(e) => updateStringValue('name', e.target.value)}
                            className="font-mono bg-muted border-border text-foreground"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* High Scores */}
                    {profileData.high_scores && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">High Scores</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(profileData.high_scores)
                              .filter(([key]) => key !== 'collection' && key !== 'current_streak')
                              .map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                  <Label className="text-sm font-medium text-card-foreground">
                                    {value.label || key}
                                  </Label>
                                  <Input
                                    type="number"
                                    value={value.amt || 0}
                                    onChange={(e) => updateValue(`high_scores.${key}.amt`, e.target.value)}
                                    className="font-mono bg-muted border-border text-foreground"
                                  />
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Career Stats */}
                    {profileData.career_stats && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Career Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ScrollArea className="h-[400px] pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Cards Discarded</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_cards_discarded || 0}
                                  onChange={(e) => updateValue('career_stats.c_cards_discarded', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Hands Played</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_hands_played || 0}
                                  onChange={(e) => updateValue('career_stats.c_hands_played', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Dollars Earned</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_dollars_earned || 0}
                                  onChange={(e) => updateValue('career_stats.c_dollars_earned', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Cards Played</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_cards_played || 0}
                                  onChange={(e) => updateValue('career_stats.c_cards_played', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Planetarium Used</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_planetarium_used || 0}
                                  onChange={(e) => updateValue('career_stats.c_planetarium_used', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Wins</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_wins || 0}
                                  onChange={(e) => updateValue('career_stats.c_wins', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Shop Rerolls</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_shop_rerolls || 0}
                                  onChange={(e) => updateValue('career_stats.c_shop_rerolls', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Interest Cap Streak</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_round_interest_cap_streak || 0}
                                  onChange={(e) => updateValue('career_stats.c_round_interest_cap_streak', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Losses</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_losses || 0}
                                  onChange={(e) => updateValue('career_stats.c_losses', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Tarots Bought</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_tarots_bought || 0}
                                  onChange={(e) => updateValue('career_stats.c_tarots_bought', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Shop Dollars Spent</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_shop_dollars_spent || 0}
                                  onChange={(e) => updateValue('career_stats.c_shop_dollars_spent', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Single Hand Streak</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_single_hand_round_streak || 0}
                                  onChange={(e) => updateValue('career_stats.c_single_hand_round_streak', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Planet Cards Bought</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_planets_bought || 0}
                                  onChange={(e) => updateValue('career_stats.c_planets_bought', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Vouchers Bought</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_vouchers_bought || 0}
                                  onChange={(e) => updateValue('career_stats.c_vouchers_bought', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Tarot Reading Used</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_tarot_reading_used || 0}
                                  onChange={(e) => updateValue('career_stats.c_tarot_reading_used', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Rounds</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_rounds || 0}
                                  onChange={(e) => updateValue('career_stats.c_rounds', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Jokers Sold</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_jokers_sold || 0}
                                  onChange={(e) => updateValue('career_stats.c_jokers_sold', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Face Cards Played</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_face_cards_played || 0}
                                  onChange={(e) => updateValue('career_stats.c_face_cards_played', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Playing Cards Bought</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_playing_cards_bought || 0}
                                  onChange={(e) => updateValue('career_stats.c_playing_cards_bought', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-card-foreground">Cards Sold</Label>
                                <Input
                                  type="number"
                                  value={profileData.career_stats.c_cards_sold || 0}
                                  onChange={(e) => updateValue('career_stats.c_cards_sold', e.target.value)}
                                  className="font-mono bg-muted border-border text-foreground"
                                />
                              </div>
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Progress */}
                    {profileData.progress && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Progress</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Overall Tally</Label>
                              <Input
                                type="number"
                                value={profileData.progress.overall_tally || 0}
                                onChange={(e) => updateValue('progress.overall_tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Challenges</Label>
                              <Input
                                type="number"
                                value={profileData.progress.challenges?.tally || 0}
                                onChange={(e) => updateValue('progress.challenges.tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Deck Stakes</Label>
                              <Input
                                type="number"
                                value={profileData.progress.deck_stakes?.tally || 0}
                                onChange={(e) => updateValue('progress.deck_stakes.tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Discovered</Label>
                              <Input
                                type="number"
                                value={profileData.progress.discovered?.tally || 0}
                                onChange={(e) => updateValue('progress.discovered.tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-card-foreground">Joker Stickers</Label>
                              <Input
                                type="number"
                                value={profileData.progress.joker_stickers?.tally || 0}
                                onChange={(e) => updateValue('progress.joker_stickers.tally', e.target.value)}
                                className="font-mono bg-muted border-border text-foreground"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {profileData.joker_usage && (
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border">
                          <CardTitle className="text-foreground">Joker Usage</CardTitle>
                          <p className="text-sm text-muted-foreground">View joker stats by stake level</p>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                          {/* Stake selector */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-card-foreground">Filter by Stake</Label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant={selectedStake === -1 ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedStake(-1)}
                              >
                                All Stakes
                              </Button>
                              {Object.entries(Balatro.Stake).map(([key, stake], index) => (
                                <Button
                                  key={key}
                                  variant={selectedStake === index ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedStake(index)}
                                  className="flex items-center gap-2"
                                >
                                  {stake.name.replace(' Stake', '')}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Search */}
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search jokers..."
                              value={jokerSearch}
                              onChange={(e) => setJokerSearch(e.target.value)}
                              className="bg-muted border-border"
                            />
                          </div>

                          {/* Table */}
                          <div className="border border-border rounded-lg overflow-hidden">
                            <ScrollArea className="h-[500px]">
                              <table className="w-full">
                                <thead className="bg-muted sticky top-0">
                                  <tr>
                                    <th className="text-left p-3 text-sm font-semibold text-card-foreground border-b border-border">Joker</th>
                                    <th className="text-center p-3 text-sm font-semibold text-card-foreground border-b border-border">Rounds</th>
                                    <th className="text-center p-3 text-sm font-semibold text-card-foreground border-b border-border">Wins</th>
                                    <th className="text-center p-3 text-sm font-semibold text-card-foreground border-b border-border">Losses</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(Balatro.Joker)
                                    .filter(([key, joker]) => 
                                      joker.name.toLowerCase().includes(jokerSearch.toLowerCase()) ||
                                      key.toLowerCase().includes(jokerSearch.toLowerCase())
                                    )
                                    .sort(([, a], [, b]) => a.order - b.order)
                                    .map(([key, joker]) => {
                                      const usage = profileData.joker_usage?.[key]
                                      const winsArray = Array.isArray(usage?.wins) ? usage.wins : []
                                      const lossesArray = Array.isArray(usage?.losses) ? usage.losses : []
                                      
                                      const wins = selectedStake === -1 
                                        ? winsArray.reduce((a, b) => a + b, 0)
                                        : (winsArray[selectedStake] ?? 0)
                                      const losses = selectedStake === -1
                                        ? lossesArray.reduce((a, b) => a + b, 0)
                                        : (lossesArray[selectedStake] ?? 0)
                                      
                                      return (
                                        <tr key={key} className="border-b border-border hover:bg-muted/50 transition-colors">
                                          <td className="p-3 text-sm text-card-foreground">{joker.name}</td>
                                          <td className="p-3 text-sm text-center text-muted-foreground">
                                            {usage?.count ?? 0}
                                          </td>
                                          <td className="p-3 text-sm text-center">
                                            <Input
                                              type="number"
                                              value={wins}
                                              onChange={(e) => {
                                                const newValue = Number.parseInt(e.target.value) || 0
                                                const newData = structuredClone(saveData) as Record<string, unknown>
                                                const jokerUsage = (newData.joker_usage as Record<string, unknown>) || {}
                                                const currentUsage = (jokerUsage[key] as Record<string, unknown>) || { wins: [], losses: [], count: 0, order: joker.order }
                                                const currentWinsArray = Array.isArray(currentUsage.wins) ? [...currentUsage.wins] : []
                                                
                                                if (selectedStake === -1) {
                                                  // Set all stakes to the same value when "All" is selected
                                                  currentUsage.wins = Array(Object.keys(Balatro.Stake).length).fill(newValue)
                                                } else {
                                                  // Ensure array is long enough
                                                  while (currentWinsArray.length <= selectedStake) {
                                                    currentWinsArray.push(0)
                                                  }
                                                  currentWinsArray[selectedStake] = newValue
                                                  currentUsage.wins = currentWinsArray
                                                }
                                                
                                                jokerUsage[key] = currentUsage
                                                newData.joker_usage = jokerUsage
                                                setSaveData(newData as DecodedSave)
                                              }}
                                              className="w-20 h-8 text-center bg-muted border-border text-foreground"
                                            />
                                          </td>
                                          <td className="p-3 text-sm text-center">
                                            <Input
                                              type="number"
                                              value={losses}
                                              onChange={(e) => {
                                                const newValue = Number.parseInt(e.target.value) || 0
                                                const newData = structuredClone(saveData) as Record<string, unknown>
                                                const jokerUsage = (newData.joker_usage as Record<string, unknown>) || {}
                                                const currentUsage = (jokerUsage[key] as Record<string, unknown>) || { wins: [], losses: [], count: 0, order: joker.order }
                                                const currentLossesArray = Array.isArray(currentUsage.losses) ? [...currentUsage.losses] : []
                                                
                                                if (selectedStake === -1) {
                                                  // Set all stakes to the same value when "All" is selected
                                                  currentUsage.losses = Array(Object.keys(Balatro.Stake).length).fill(newValue)
                                                } else {
                                                  // Ensure array is long enough
                                                  while (currentLossesArray.length <= selectedStake) {
                                                    currentLossesArray.push(0)
                                                  }
                                                  currentLossesArray[selectedStake] = newValue
                                                  currentUsage.losses = currentLossesArray
                                                }
                                                
                                                jokerUsage[key] = currentUsage
                                                newData.joker_usage = jokerUsage
                                                setSaveData(newData as DecodedSave)
                                              }}
                                              className="w-20 h-8 text-center bg-muted border-border text-foreground"
                                            />
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </ScrollArea>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}

                {isMetaFile && metaData?.discovered && metaData?.unlocked && (
                  <TabsContent value="meta" className="space-y-4 mt-4">
                    <Card className="bg-card border-border">
                      <CardHeader className="border-b border-border">
                        <CardTitle className="text-foreground">Meta - Unlocked/Discovered Items</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search items..."
                            value={metaSearch}
                            onChange={(e) => setMetaSearch(e.target.value)}
                            className="bg-muted border-border"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left column: Undiscovered/Locked */}
                          <div className="bg-muted/50 p-4 rounded-lg border border-border">
                            <h3 className="text-sm font-semibold mb-3 text-card-foreground">
                              Undiscovered/Locked ({Object.keys(AllItems).filter(key => 
                                (!metaData.discovered[key] || !metaData.unlocked[key]) && 
                                key.toLowerCase().includes(metaSearch.toLowerCase())
                              ).length})
                            </h3>
                            <ScrollArea className="h-[600px] pr-4">
                              <div className="space-y-2">
                                {Object.keys(AllItems)
                                  .filter(key => key.toLowerCase().includes(metaSearch.toLowerCase()))
                                  .filter(key => !metaData.discovered[key] || !metaData.unlocked[key])
                                  .sort((a, b) => {
                                    const itemA = AllItems[a]
                                    const itemB = AllItems[b]
                                    return (itemA?.name || a).localeCompare(itemB?.name || b)
                                  })
                                  .map((key) => {
                                    const item = AllItems[key]
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => {
                                          const newData = structuredClone(saveData) as Record<string, unknown>
                                          const newDiscovered = { ...(metaData.discovered || {}), [key]: true }
                                          const newUnlocked = { ...(metaData.unlocked || {}), [key]: true }
                                          newData.discovered = newDiscovered
                                          newData.unlocked = newUnlocked
                                          setSaveData(newData as DecodedSave)
                                        }}
                                        className="w-full flex items-center justify-between p-2 bg-card hover:bg-muted border border-border rounded transition-colors text-left group"
                                      >
                                        <span className="text-sm text-card-foreground">{item?.name || key}</span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                      </button>
                                    )
                                  })}
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Right column: Discovered/Unlocked */}
                          <div className="bg-muted/50 p-4 rounded-lg border border-border">
                            <h3 className="text-sm font-semibold mb-3 text-card-foreground">
                              Discovered/Unlocked ({Object.keys(AllItems).filter(key => 
                                (metaData.discovered[key] === true) && 
                                key.toLowerCase().includes(metaSearch.toLowerCase())
                              ).length})
                            </h3>
                            <ScrollArea className="h-[600px] pr-4">
                              <div className="space-y-2">
                                {Object.keys(AllItems)
                                  .filter(key => key.toLowerCase().includes(metaSearch.toLowerCase()))
                                  .filter(key => metaData.discovered[key] === true)
                                  .sort((a, b) => {
                                    const itemA = AllItems[a]
                                    const itemB = AllItems[b]
                                    return (itemA?.name || a).localeCompare(itemB?.name || b)
                                  })
                                  .map((key) => {
                                    const item = AllItems[key]
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => {
                                          const newData = structuredClone(saveData) as Record<string, unknown>
                                          const newDiscovered = { ...(metaData.discovered || {}), [key]: false }
                                          const newUnlocked = { ...(metaData.unlocked || {}), [key]: false }
                                          newData.discovered = newDiscovered
                                          newData.unlocked = newUnlocked
                                          setSaveData(newData as DecodedSave)
                                        }}
                                        className="w-full flex items-center justify-between p-2 bg-card hover:bg-muted border border-border rounded transition-colors text-left group"
                                      >
                                        <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm text-card-foreground">{item?.name || key}</span>
                                      </button>
                                    )
                                  })}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                <TabsContent value="raw" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Code className="w-5 h-5" />
                        Raw JSON Editor
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <JsonTreeEditor data={saveData} onChange={setSaveData} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>{originalFile?.name} loaded</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {saveData && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-end">
            <Button
              onClick={handleDownload}
              disabled={isProcessing}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
            >
              <Save className="w-5 h-5 mr-2" />
              {isProcessing ? "Processing..." : "Download Edited Save"}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
