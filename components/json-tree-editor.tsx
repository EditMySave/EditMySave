"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Edit2, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface JsonTreeEditorProps {
  data: any
  onChange: (newData: any) => void
}

interface JsonNodeProps {
  keyName: string
  value: any
  path: string[]
  onUpdate: (path: string[], newValue: any) => void
  level: number
}

function JsonNode({ keyName, value, path, onUpdate, level }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isPrimitive = !isObject && !isArray

  const getValueType = (val: any): string => {
    if (val === null) return "null"
    if (Array.isArray(val)) return "array"
    return typeof val
  }

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "string":
        return "text-green-400"
      case "number":
        return "text-blue-400"
      case "boolean":
        return "text-purple-400"
      case "null":
        return "text-slate-500"
      case "array":
        return "text-yellow-400"
      case "object":
        return "text-cyan-400"
      default:
        return "text-slate-300"
    }
  }

  const handleEdit = () => {
    setEditValue(String(value))
    setIsEditing(true)
  }

  const handleSave = () => {
    let newValue: any = editValue
    const type = getValueType(value)

    if (type === "number") {
      newValue = Number.parseFloat(editValue)
      if (Number.isNaN(newValue)) newValue = 0
    } else if (type === "boolean") {
      newValue = editValue.toLowerCase() === "true"
    } else if (type === "null") {
      newValue = null
    }

    onUpdate(path, newValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue("")
  }

  const indent = level * 20

  if (isPrimitive) {
    const type = getValueType(value)
    return (
      <div className="flex items-center gap-2 py-1 hover:bg-slate-800/30 rounded px-2" style={{ paddingLeft: indent }}>
        <span className="text-slate-400 font-mono text-sm min-w-[120px]">{keyName}:</span>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 font-mono text-sm bg-slate-900/50 border-slate-700 text-slate-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
                if (e.key === "Escape") handleCancel()
              }}
            />
            <Button onClick={handleSave} size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-400">
              <Check className="w-4 h-4" />
            </Button>
            <Button onClick={handleCancel} size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 max-w-full">
            <span className={`font-mono text-sm break-all ${getTypeColor(type)}`}>
              {type === "string" ? `"${value}"` : String(value)}
            </span>
            <Button
              onClick={handleEdit}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-100 flex-shrink-0"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  const entries = isArray ? value.map((v: any, i: number) => [i, v]) : Object.entries(value)
  const preview = isArray ? `[${value.length}]` : `{${Object.keys(value).length}}`

  return (
    <div className="group">
      <div
        className="flex items-center gap-2 py-1 hover:bg-slate-800/30 rounded px-2 cursor-pointer"
        style={{ paddingLeft: indent }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
        <span className="text-slate-400 font-mono text-sm">{keyName}:</span>
        <span className={`font-mono text-sm ${getTypeColor(isArray ? "array" : "object")}`}>{preview}</span>
      </div>
      {isExpanded && (
        <div>
          {entries.map(([key, val]: [any, any]) => (
            <JsonNode
              key={key}
              keyName={String(key)}
              value={val}
              path={[...path, String(key)]}
              onUpdate={onUpdate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function JsonTreeEditor({ data, onChange }: JsonTreeEditorProps) {
  const handleUpdate = (path: string[], newValue: any) => {
    const newData = JSON.parse(JSON.stringify(data))
    let current = newData

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }

    current[path[path.length - 1]] = newValue
    onChange(newData)
  }

  return (
    <ScrollArea className="h-[600px] w-full rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="font-mono text-sm">
        {Object.entries(data).map(([key, value]) => (
          <JsonNode key={key} keyName={key} value={value} path={[key]} onUpdate={handleUpdate} level={0} />
        ))}
      </div>
    </ScrollArea>
  )
}
