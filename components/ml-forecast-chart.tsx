"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Brain, TrendingUp } from "lucide-react"

interface ForecastData {
  period: string
  actual: number
  traditional: number
  mlForecast: number
  confidence: number
}

const forecastData: ForecastData[] = [
  { period: "Jan", actual: 145000, traditional: 140000, mlForecast: 147000, confidence: 85 },
  { period: "Feb", actual: 162000, traditional: 155000, mlForecast: 159000, confidence: 87 },
  { period: "Mar", actual: 158000, traditional: 165000, mlForecast: 161000, confidence: 82 },
  { period: "Apr", actual: 189000, traditional: 180000, mlForecast: 186000, confidence: 89 },
  { period: "May", actual: 195000, traditional: 190000, mlForecast: 198000, confidence: 91 },
  { period: "Jun", actual: 0, traditional: 205000, mlForecast: 212000, confidence: 88 },
  { period: "Jul", actual: 0, traditional: 215000, mlForecast: 225000, confidence: 86 },
  { period: "Aug", actual: 0, traditional: 225000, mlForecast: 238000, confidence: 84 },
]

export function MLForecastChart() {
  const [model, setModel] = useState<"linear" | "random-forest" | "neural-network">("random-forest")

  const getModelAccuracy = (model: string) => {
    switch (model) {
      case "linear":
        return 78
      case "random-forest":
        return 87
      case "neural-network":
        return 92
      default:
        return 87
    }
  }

  const getModelDescription = (model: string) => {
    switch (model) {
      case "linear":
        return "Simple linear regression based on historical trends"
      case "random-forest":
        return "Ensemble model considering multiple market factors"
      case "neural-network":
        return "Deep learning model with advanced pattern recognition"
      default:
        return "Ensemble model considering multiple market factors"
    }
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <CardTitle>ML Revenue Forecast</CardTitle>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="secondary" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{getModelAccuracy(model)}% accuracy</span>
          </Badge>
          <Select value={model} onValueChange={(value: any) => setModel(value)}>
            <SelectTrigger className="w-48 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear Regression</SelectItem>
              <SelectItem value="random-forest">Random Forest</SelectItem>
              <SelectItem value="neural-network">Neural Network</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{getModelDescription(model)}</p>
        <ResponsiveContainer width="100%" height={350}>
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
            <ReferenceLine x="May" stroke="#ef4444" strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", strokeWidth: 2, r: 6 }}
              name="Actual Revenue"
            />
            <Line
              type="monotone"
              dataKey="traditional"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#6b7280", strokeWidth: 2, r: 4 }}
              name="Traditional Forecast"
            />
            <Line
              type="monotone"
              dataKey="mlForecast"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 6 }}
              name="ML Forecast"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Traditional Model</p>
            <p className="text-lg font-semibold text-gray-500">$1.85M</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">ML Prediction</p>
            <p className="text-lg font-semibold text-purple-500">$2.01M</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Confidence</p>
            <p className="text-lg font-semibold text-blue-500">87%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
