"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface SaveFileUploadProps {
  onFileSelect: (file: File) => void
  acceptedFileTypes?: string
  isProcessing?: boolean
}

export function SaveFileUpload({
  onFileSelect,
  acceptedFileTypes = ".dat",
  isProcessing = false,
}: SaveFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      if (isProcessing) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect, isProcessing],
  )

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return

    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }

  return (
    <Card className="border-2 border-dashed border-border">
      <CardContent className="pt-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-4 p-12 rounded-lg transition-colors ${
            isDragging ? "bg-accent" : "bg-card"
          } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
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
            accept={acceptedFileTypes}
            disabled={isProcessing}
          />
          <Button asChild variant="secondary" disabled={isProcessing}>
            <label htmlFor="file-input" className="cursor-pointer">
              {isProcessing ? "Processing..." : "Browse Files"}
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
