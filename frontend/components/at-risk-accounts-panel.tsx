"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useChurnRisk } from "@/hooks/use-api"
import { RiskBadge } from "@/components/risk-badge"
import { AlertTriangle, ChevronDown } from "lucide-react"
import type { ChurnPrediction } from "@/lib/api-client"

export function AtRiskAccountsPanel() {
  const { data, isLoading, error } = useChurnRisk()
  const [expanded, setExpanded] = useState<string | null>(null)

  const atRisk = (data || []).filter((p) => p.tier !== "low")

  if (isLoading) {
    return (
      <Card className="backdrop-blur-sm bg-white/10 border-white/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="backdrop-blur-sm bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle>At-Risk Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 border-white/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <CardTitle className="text-lg">At-Risk Accounts</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs text-red-400 border-red-400/40">
          {atRisk.length} at risk
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {atRisk.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">All accounts are healthy.</p>
        )}
        <AnimatePresence>
          {atRisk.map((pred, index) => (
            <motion.div
              key={pred.account_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg bg-white/5 border border-white/10 p-3"
            >
              <button
                onClick={() => setExpanded(expanded === pred.account_id ? null : pred.account_id)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{pred.account_name}</p>
                  <div className="mt-1">
                    <RiskBadge riskScore={pred.risk_score} tier={pred.tier} confidence={pred.confidence} factors={pred.top_factors} />
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${expanded === pred.account_id ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {expanded === pred.account_id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-3 space-y-1 pl-1 text-xs text-gray-600 dark:text-gray-300">
                      {pred.top_factors.map((f, i) => (
                        <li key={i}>• {f.factor}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
