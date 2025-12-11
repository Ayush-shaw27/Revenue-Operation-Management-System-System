"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Code, Database, Brain, Zap } from "lucide-react"

export function FlaskAPIPlaceholder() {
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "loading">("disconnected")

  const handleConnect = async () => {
    setApiStatus("loading")

    // Simulate API connection
    setTimeout(() => {
      setApiStatus("connected")
    }, 2000)
  }

  const apiEndpoints = [
    {
      method: "POST",
      endpoint: "/api/ml/lead-score",
      description: "Calculate AI lead conversion probability",
      model: "Random Forest Classifier",
    },
    {
      method: "GET",
      endpoint: "/api/ml/revenue-forecast",
      description: "Generate ML-powered revenue predictions",
      model: "Linear Regression + Neural Network",
    },
    {
      method: "POST",
      endpoint: "/api/ml/pipeline-insights",
      description: "Analyze pipeline health and generate insights",
      model: "Natural Language Processing",
    },
    {
      method: "GET",
      endpoint: "/api/data/leads",
      description: "Fetch leads data from MySQL database",
      model: "Database Query",
    },
  ]

  return (
    <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="w-5 h-5 text-blue-500" />
          <CardTitle>Flask API Integration</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Badge
            variant={apiStatus === "connected" ? "default" : "secondary"}
            className={apiStatus === "connected" ? "bg-green-500" : ""}
          >
            {apiStatus === "connected" ? "Connected" : "Disconnected"}
          </Badge>
          <Button size="sm" onClick={handleConnect} disabled={apiStatus === "loading"}>
            {apiStatus === "loading" ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Backend Integration Status: Ready for Flask + Python ML models
        </div>

        <div className="space-y-3">
          {apiEndpoints.map((endpoint, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-white/5 dark:bg-gray-800/20 border border-white/10 dark:border-gray-700/20"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono text-blue-400">{endpoint.endpoint}</code>
                </div>
                <div className="flex items-center space-x-1">
                  {endpoint.model.includes("Neural") && <Brain className="w-4 h-4 text-purple-500" />}
                  {endpoint.model.includes("Database") && <Database className="w-4 h-4 text-green-500" />}
                  {endpoint.model.includes("Random Forest") && <Zap className="w-4 h-4 text-yellow-500" />}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{endpoint.description}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Model: {endpoint.model}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Integration Notes:</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Flask backend with SQLAlchemy for MySQL integration</li>
            <li>• Scikit-learn models for lead scoring and forecasting</li>
            <li>• CORS enabled for frontend API calls</li>
            <li>• JWT authentication for secure endpoints</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
