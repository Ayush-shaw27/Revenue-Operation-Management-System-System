"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Brain } from "lucide-react"

interface LeadScoreBadgeProps {
  score: number
  factors?: string[]
}

export function LeadScoreBadge({ score, factors = [] }: LeadScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Hot"
    if (score >= 60) return "Warm"
    if (score >= 40) return "Cool"
    return "Cold"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${getScoreColor(score)} flex items-center space-x-1 cursor-help`}>
            <Brain className="w-3 h-3" />
            <span>
              {score}% {getScoreLabel(score)}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">AI Lead Score: {score}%</p>
            {factors.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Key factors:</p>
                <ul className="text-xs space-y-1">
                  {factors.map((factor, index) => (
                    <li key={index}>• {factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
