"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertOctagon } from "lucide-react"

interface AnomalyWarningBadgeProps {
  reasons: string[]
}

export function AnomalyWarningBadge({ reasons }: AnomalyWarningBadgeProps) {
  if (reasons.length === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 cursor-help">
            <AlertOctagon className="w-3 h-3 mr-1" />
            Anomaly
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 max-w-xs">
            <p className="font-medium text-sm">Anomaly detected</p>
            <ul className="text-xs space-y-1">
              {reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
