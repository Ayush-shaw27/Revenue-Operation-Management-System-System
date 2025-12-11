"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"

interface AIInsight {
  id: string
  type: "positive" | "warning" | "neutral"
  title: string
  description: string
  confidence: number
  actionable: boolean
  actions?: {
    title: string
    description: string
    type: "email" | "call" | "meeting" | "report" | "optimize"
  }[]
}

export function AIInsightsWidget() {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false)

  // Simulate AI insights generation
  const generateInsights = async () => {
    setIsLoading(true)

    // Simulate API call to ML backend
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const mockInsights: AIInsight[] = [
      {
        id: "1",
        type: "positive",
        title: "Strong Pipeline Health",
        description:
          "Your pipeline shows 23% higher conversion rates than industry average. Focus on Enterprise deals for maximum impact.",
        confidence: 87,
        actionable: true,
        actions: [
          {
            title: "Schedule Enterprise Review",
            description: "Book a meeting to review high-value enterprise opportunities",
            type: "meeting",
          },
          {
            title: "Generate Pipeline Report",
            description: "Create detailed analysis of current pipeline performance",
            type: "report",
          },
        ],
      },
      {
        id: "2",
        type: "warning",
        title: "Lead Response Time Alert",
        description:
          "Average response time to new leads has increased by 34% this month. Quick action could improve conversion by 15%.",
        confidence: 92,
        actionable: true,
        actions: [
          {
            title: "Email Team Reminder",
            description: "Send automated reminder to sales team about response times",
            type: "email",
          },
          {
            title: "Call Team Meeting",
            description: "Schedule urgent team meeting to address response time issues",
            type: "call",
          },
          {
            title: "Optimize Workflow",
            description: "Review and optimize lead assignment workflow",
            type: "optimize",
          },
        ],
      },
      {
        id: "3",
        type: "neutral",
        title: "Seasonal Trend Detected",
        description:
          "Q1 typically shows 18% lower activity. Consider adjusting targets and increasing marketing spend.",
        confidence: 78,
        actionable: true,
        actions: [
          {
            title: "Adjust Q1 Targets",
            description: "Modify quarterly targets based on seasonal trends",
            type: "optimize",
          },
          {
            title: "Marketing Strategy Meeting",
            description: "Plan increased marketing activities for Q1",
            type: "meeting",
          },
        ],
      },
    ]

    setInsights(mockInsights)
    setIsLoading(false)
    toast.success("AI insights updated successfully!")
  }

  const handleTakeAction = (insight: AIInsight) => {
    setSelectedInsight(insight)
    setIsActionDialogOpen(true)
  }

  const executeAction = async (action: any) => {
    setIsActionDialogOpen(false)

    switch (action.type) {
      case "email":
        toast.success("Email sent to team members")
        // Simulate email sending
        break
      case "call":
        toast.success("Meeting scheduled with team")
        // Simulate meeting scheduling
        break
      case "meeting":
        toast.success("Calendar invite sent")
        // Simulate calendar integration
        break
      case "report":
        toast.success("Report generation started")
        // Simulate report generation
        break
      case "optimize":
        toast.success("Workflow optimization initiated")
        // Simulate workflow optimization
        break
      default:
        toast.info("Action completed")
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

  const getActionIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />
      case "call":
        return <Phone className="w-4 h-4" />
      case "meeting":
        return <Calendar className="w-4 h-4" />
      case "report":
        return <ExternalLink className="w-4 h-4" />
      case "optimize":
        return <TrendingUp className="w-4 h-4" />
      default:
        return <ExternalLink className="w-4 h-4" />
    }
  }

  return (
    <>
      <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-lg">AI Insights</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={generateInsights} disabled={isLoading} className="h-8 w-8 p-0">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : (
            insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-3 rounded-lg border-l-4 ${getInsightColor(insight.type)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getInsightIcon(insight.type)}
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {insight.confidence}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{insight.description}</p>
                {insight.actionable && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 bg-transparent"
                    onClick={() => handleTakeAction(insight)}
                  >
                    Take Action
                  </Button>
                )}
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <span>AI Recommended Actions</span>
            </DialogTitle>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-white/5 dark:bg-gray-800/20">
                <h4 className="font-medium mb-1">{selectedInsight.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedInsight.description}</p>
              </div>

              <div className="space-y-2">
                <h5 className="font-medium text-sm">Recommended Actions:</h5>
                {selectedInsight.actions?.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 dark:bg-gray-800/20"
                  >
                    <div className="flex items-center space-x-3">
                      {getActionIcon(action.type)}
                      <div>
                        <p className="font-medium text-sm">{action.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{action.description}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => executeAction(action)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      Execute
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
