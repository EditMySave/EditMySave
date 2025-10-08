"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Platform {
  name: string
  supported: boolean
  saveLocation?: {
    windows?: string
    mac?: string
    linux?: string
  }
}

interface SaveLocationHelpProps {
  platforms: Platform[]
  gameName: string
}

export function SaveLocationHelp({ platforms, gameName }: SaveLocationHelpProps) {
  // Filter to only show platforms that are defined
  const availablePlatforms = platforms.filter((p) => p)

  if (availablePlatforms.length === 0) {
    return null
  }

  return (
    <Card className="border-border bg-muted/50">
      <CardContent className="pt-4 pb-4">
        <Tabs defaultValue={availablePlatforms[0].name} className="w-full">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center">
              <TabsList>
                {availablePlatforms.map((platform) => (
                  <TabsTrigger key={platform.name} value={platform.name} className="text-xs">
                    {platform.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {availablePlatforms.map((platform) => (
              <TabsContent key={platform.name} value={platform.name} className="mt-0">
                {platform.supported && platform.saveLocation ? (
                  <div className="space-y-3">
                    {platform.saveLocation.windows && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Windows:</p>
                        <code className="block text-xs bg-background px-3 py-2 rounded border border-border break-all">
                          {platform.saveLocation.windows}
                        </code>
                      </div>
                    )}
                    {platform.saveLocation.mac && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">macOS:</p>
                        <code className="block text-xs bg-background px-3 py-2 rounded border border-border break-all">
                          {platform.saveLocation.mac}
                        </code>
                      </div>
                    )}
                    {platform.saveLocation.linux && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Linux:</p>
                        <code className="block text-xs bg-background px-3 py-2 rounded border border-border break-all">
                          {platform.saveLocation.linux}
                        </code>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {gameName} save editing is not currently supported for {platform.name}. We're working on adding
                      support for this platform.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
