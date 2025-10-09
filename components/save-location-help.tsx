"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, FolderOpen, FileText, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

interface Platform {
  name: string
  supported: boolean
  saveLocation?: {
    windows?: string
    mac?: string
    linux?: string
  }
  saveFileName?: string
  instructions?: string
  notes?: string
}

interface SaveLocationHelpProps {
  platforms: Platform[]
  gameName: string
}

export function SaveLocationHelp({ platforms, gameName }: SaveLocationHelpProps) {
  const availablePlatforms = platforms.filter((p) => p)

  if (availablePlatforms.length === 0) {
    return null
  }

  return (
    <Card className="border-border bg-muted/50">
      <Tabs defaultValue={availablePlatforms[0].name} className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Save File Location
            </CardTitle>
            <TabsList>
              {availablePlatforms.map((platform) => (
                <TabsTrigger key={platform.name} value={platform.name} className="text-xs">
                  {platform.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          {availablePlatforms.map((platform) => (
            <TabsContent key={platform.name} value={platform.name} className="mt-0">
              {platform.supported && platform.saveLocation ? (
                <div className="space-y-2">
                  {platform.saveFileName && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">Save File:</p>
                      </div>
                      <code className="block text-xs bg-background px-2 py-1.5 rounded border border-border">
                        {platform.saveFileName}
                      </code>
                    </div>
                  )}

                  {platform.saveFileName && <Separator className="my-2" />}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">File Path:</p>
                    {platform.saveLocation.windows && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Windows</p>
                        <code className="block text-xs bg-background px-2 py-1.5 rounded border border-border break-all">
                          {platform.saveLocation.windows}
                        </code>
                      </div>
                    )}
                    {platform.saveLocation.mac && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">macOS</p>
                        <code className="block text-xs bg-background px-2 py-1.5 rounded border border-border break-all">
                          {platform.saveLocation.mac}
                        </code>
                      </div>
                    )}
                    {platform.saveLocation.linux && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Linux</p>
                        <code className="block text-xs bg-background px-2 py-1.5 rounded border border-border break-all">
                          {platform.saveLocation.linux}
                        </code>
                      </div>
                    )}
                  </div>

                  {platform.instructions && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Info className="h-3 w-3 text-blue-500" />
                          <p className="text-xs font-medium text-muted-foreground">Instructions:</p>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{platform.instructions}</p>
                      </div>
                    </>
                  )}

                  {platform.notes && (
                    <>
                      <Separator className="my-2" />
                      <Alert className="bg-amber-500/10 border-amber-500/20 py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        <AlertDescription className="text-xs text-foreground leading-relaxed">
                          {platform.notes}
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </div>
              ) : (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    {gameName} save editing is not currently supported for {platform.name}. We're working on adding
                    support for this platform.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  )
}
