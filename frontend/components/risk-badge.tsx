"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertTriangle } from "lucide-react"
import type { ChurnFactor } from "@/lib/api-client"

interface RiskBadgeProps {
  riskScore: number
  tier: string
  confidence?: number
  factors?: ChurnFactor[]
}

export function RiskBadge({ riskScore, tier, confidence, factors = [] }: RiskBadgeProps) {
  const tierInfo: Record<string, { label: string; classes: string }> = {
    low: { label: "Low Risk", classes: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
    medium: { label: "Medium Risk", classes: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
    high: { label: "High Risk", classes: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  }
  const info = tierInfo[tier] || tierInfo.low

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            <Badge className={`${info.classes} flex items-center space-x-1 cursor-help`}>
              <AlertTriangle className="w-3 h-3" />
              <span>
                {Math.round(riskScore * 100)}% {info.label}
              </span>
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 max-w-xs">
            <p className="font-medium">Churn Risk Score: {Math.round(riskScore * 100)}%</p>
            {confidence && <p className="text-xs">Confidence: {confidence}%</p>}
            {factors.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Top factors:</p>
                <ul className="text-xs space-y-1">
                  {factors.map((f, i) => (
                    <li key={i}>• {f.factor}</li>
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
