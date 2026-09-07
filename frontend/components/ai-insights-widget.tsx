"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Zap } from "lucide-react"
import { fetchPipelineInsights, AIInsightItem } from "@/lib/api-client"

export function AIInsightsWidget() {
  const [insights, setInsights] = useState<AIInsightItem[]>([])
  const [healthScore, setHealthScore] = useState<number>(88)
  const [winRate, setWinRate] = useState<number>(68.4)
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)

  const generateInsights = async () => {
    setIsLoading(true)
    try {
      const result = await fetchPipelineInsights()
      setInsights(result.insights)
      setHealthScore(result.pipeline_health_score)
      setWinRate(result.win_rate_estimate)
      setIsLive(true)
    } catch {
      setIsLive(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateInsights()
  }, [])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default:
        return <TrendingUp className="w-5 h-5 text-blue-500" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case "positive":
        return "border-l-green-500 bg-green-50/50 dark:bg-green-900/20"
      case "warning":
        return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20"
      default:
        return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
    }
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <CardTitle className="text-lg">AI Pipeline Intelligence & Insights</CardTitle>
          <Badge variant="outline" className="text-xs ml-2 text-purple-400 border-purple-400/40">
            {isLive ? "Live ML Feed" : "Simulated"}
          </Badge>
        </div>
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <span className="text-gray-400">Health:</span>
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {healthScore}/100
            </Badge>
            <span className="text-gray-400 ml-2">Est. Win:</span>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {winRate}%
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateInsights}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            title="Refresh Insights from ML"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-3 rounded-lg border border-white/5 bg-white/5">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : (
          insights.map((insight, index) => (
            <motion.div
              key={insight.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-3.5 rounded-lg border-l-4 ${getInsightColor(insight.type)}`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  {getInsightIcon(insight.type)}
                  <h4 className="font-medium text-sm">{insight.title}</h4>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {insight.confidence}% confidence
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{insight.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-white/10">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" />
                  Impact: <strong>{insight.metric_affected}</strong>
                </span>
                {insight.actionable && (
                  <Button size="sm" variant="outline" className="text-xs h-6 px-2 bg-transparent hover:bg-white/10">
                    Apply Recommended Action
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
