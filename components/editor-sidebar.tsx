"use client"

import type React from "react"

import { Upload, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EditorSidebarProps {
  onDownload: () => void
  onLoadNew: () => void
  isProcessing: boolean
  hasSaveData: boolean
  fileName?: string
  fileSize?: number
  lastModified?: Date
  quickStats?: Array<{ label: string; value: string | number; icon?: React.ReactNode }>
  quickActions?: Array<{ label: string; onClick: () => void; icon?: React.ReactNode }>
}

export function EditorSidebar({
  onDownload,
  onLoadNew,
  isProcessing,
  hasSaveData,
  fileName,
  fileSize,
  lastModified,
  quickStats = [],
  quickActions = [],
}: EditorSidebarProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="w-72 shrink-0">
      <div className="sticky top-4 space-y-2">
        {hasSaveData && fileName && (
          <Card className="bg-card border-border gap-0">
            <CardHeader className="pb-0 space-y-0">
              <CardTitle className="text-sm font-semibold text-card-foreground">Save File Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm pt-0">
              {fileName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File:</span>
                  <span className="text-card-foreground font-mono text-xs truncate max-w-[140px]" title={fileName}>
                    {fileName}
                  </span>
                </div>
              )}
              {fileSize && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="text-card-foreground">{formatFileSize(fileSize)}</span>
                </div>
              )}
              {lastModified && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loaded:</span>
                  <span className="text-card-foreground">{formatDate(lastModified)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasSaveData && quickStats.length > 0 && (
          <Card className="bg-card border-border gap-0">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-card-foreground">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {quickStats.map((stat, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {stat.icon}
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-foreground">{stat.value.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hasSaveData && quickActions.length > 0 && (
          <Card className="bg-card border-border gap-0">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-card-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border gap-0">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              {hasSaveData ? "Backup" : "Actions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {hasSaveData && (
              <Button
                onClick={onDownload}
                disabled={isProcessing}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {isProcessing ? "Processing..." : "Download Edited Save"}
              </Button>
            )}
            <Button
              onClick={onLoadNew}
              disabled={!hasSaveData}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground hover:bg-muted"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Load Different Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
