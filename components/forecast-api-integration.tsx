"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Brain, RefreshCw, Database, Zap } from "lucide-react"
import { toast } from "sonner"

interface ForecastData {
  period: string
  predicted_revenue: number
  confidence_interval_low: number
  confidence_interval_high: number
  actual_revenue?: number
}

interface APIResponse {
  success: boolean
  data: ForecastData[]
  model_info: {
    algorithm: string
    accuracy: number
    last_trained: string
  }
  message?: string
}

export function ForecastAPIIntegration() {
  const [forecastData, setForecastData] = useState<ForecastData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [modelInfo, setModelInfo] = useState<any>(null)
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "error">("disconnected")

  // Simulate Flask API call to /forecast_ai endpoint
  const fetchForecastData = async () => {
    setIsLoading(true)

    try {
      // Simulate API call - replace with actual Flask endpoint
      const response = await simulateFlaskAPI()

      if (response.success) {
        setForecastData(response.data)
        setModelInfo(response.model_info)
        setApiStatus("connected")
        toast.success("AI forecast data updated successfully")
      } else {
        throw new Error(response.message || "Failed to fetch forecast data")
      }
    } catch (error) {
      setApiStatus("error")
      toast.error("Failed to connect to AI forecasting service")
      console.error("Forecast API Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Simulate Flask API response - replace with actual fetch call
  const simulateFlaskAPI = async (): Promise<APIResponse> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock response that matches Flask backend structure
    return {
      success: true,
      data: [
        {
          period: "2024-02",
          predicted_revenue: 145000,
          confidence_interval_low: 135000,
          confidence_interval_high: 155000,
          actual_revenue: 142000,
        },
        {
          period: "2024-03",
          predicted_revenue: 162000,
          confidence_interval_low: 150000,
          confidence_interval_high: 174000,
          actual_revenue: 159000,
        },
        {
          period: "2024-04",
          predicted_revenue: 178000,
          confidence_interval_low: 165000,
          confidence_interval_high: 191000,
        },
        {
          period: "2024-05",
          predicted_revenue: 195000,
          confidence_interval_low: 180000,
          confidence_interval_high: 210000,
        },
        {
          period: "2024-06",
          predicted_revenue: 212000,
          confidence_interval_low: 195000,
          confidence_interval_high: 229000,
        },
      ],
      model_info: {
        algorithm: "Random Forest Regressor",
        accuracy: 87.3,
        last_trained: "2024-01-19T10:30:00Z",
      },
    }
  }

  useEffect(() => {
    fetchForecastData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected"
      case "error":
        return "Error"
      default:
        return "Disconnected"
    }
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <CardTitle>AI Revenue Forecasting</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={`${getStatusColor(apiStatus)} text-white`}>{getStatusText(apiStatus)}</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchForecastData}
            disabled={isLoading}
            className="bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Integration Info */}
        <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
          <div className="flex items-center space-x-2 mb-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800 dark:text-blue-300">Flask API Integration</span>
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>
              • Endpoint: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/forecast_ai</code>
            </p>
            <p>• Method: POST with pipeline data</p>
            <p>• Response: JSON with predictions and confidence intervals</p>
          </div>
        </div>

        {/* Model Information */}
        {modelInfo && (
          <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-white/5 dark:bg-gray-800/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Algorithm</p>
              <p className="font-medium flex items-center justify-center">
                <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                {modelInfo.algorithm}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
              <p className="font-medium text-green-600">{modelInfo.accuracy}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Trained</p>
              <p className="font-medium text-xs">{new Date(modelInfo.last_trained).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading AI predictions...</p>
            </div>
          </div>
        ) : forecastData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="period" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  backdropFilter: "blur(10px)",
                }}
              />

              {/* Confidence Interval Area */}
              <Line
                type="monotone"
                dataKey="confidence_interval_high"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeDasharray="2 2"
                dot={false}
                name="Upper Confidence"
              />
              <Line
                type="monotone"
                dataKey="confidence_interval_low"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeDasharray="2 2"
                dot={false}
                name="Lower Confidence"
              />

              {/* Actual Revenue */}
              <Line
                type="monotone"
                dataKey="actual_revenue"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 6 }}
                name="Actual Revenue"
              />

              {/* Predicted Revenue */}
              <Line
                type="monotone"
                dataKey="predicted_revenue"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 6 }}
                name="AI Prediction"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">No forecast data available</div>
        )}

        {/* API Call Example */}
        <div className="p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/20 border border-gray-200/50 dark:border-gray-700/50">
          <h5 className="font-medium text-sm mb-2">Flask Integration Example:</h5>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            {`# Flask endpoint example
@app.route('/forecast_ai', methods=['POST'])
def forecast_revenue():
    pipeline_data = request.json
    predictions = ml_model.predict(pipeline_data)
    return jsonify({
        'success': True,
        'data': predictions,
        'model_info': {
            'algorithm': 'Random Forest',
            'accuracy': model_accuracy
        }
    })`}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
