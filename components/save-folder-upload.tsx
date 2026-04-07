"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface SaveFolderUploadProps {
  onFolderSelect: (files: FileList) => void
  isProcessing?: boolean
}

async function readDirectoryEntry(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const files: File[] = []
  const reader = entry.createReader()

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject))

  let batch = await readBatch()
  while (batch.length > 0) {
    for (const child of batch) {
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (child as FileSystemFileEntry).file(resolve, reject),
        )
        // Reconstruct webkitRelativePath from fullPath (strip leading /)
        Object.defineProperty(file, "webkitRelativePath", {
          value: child.fullPath.replace(/^\//, ""),
          writable: false,
        })
        files.push(file)
      } else if (child.isDirectory) {
        const subFiles = await readDirectoryEntry(child as FileSystemDirectoryEntry)
        files.push(...subFiles)
      }
    }
    batch = await readBatch()
  }
  return files
}

export function SaveFolderUpload({ onFolderSelect, isProcessing = false }: SaveFolderUploadProps) {
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

      const items = Array.from(e.dataTransfer.items)
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry?.isDirectory) {
          const files = await readDirectoryEntry(entry as FileSystemDirectoryEntry)
          // Create a FileList-like object from the files array
          const dt = new DataTransfer()
          for (const f of files) dt.items.add(f)
          onFolderSelect(dt.files)
          return
        }
      }
    },
    [onFolderSelect, isProcessing],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return
    const files = e.target.files
    if (files && files.length > 0) {
      onFolderSelect(files)
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
          <FolderOpen className="w-12 h-12 text-muted-foreground" />
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Drop your save folder here</p>
            <p className="text-sm text-muted-foreground">or click to browse for your save game folder</p>
          </div>
          <input
            type="file"
            id="folder-input"
            className="hidden"
            onChange={handleFileInput}
            /* @ts-expect-error webkitdirectory is non-standard */
            webkitdirectory=""
            directory=""
            disabled={isProcessing}
          />
          <Button asChild variant="secondary" disabled={isProcessing}>
            <label htmlFor="folder-input" className="cursor-pointer">
              {isProcessing ? "Processing..." : "Browse Folder"}
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
