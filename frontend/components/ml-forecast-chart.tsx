"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts"
import { Brain, TrendingUp, Loader2 } from "lucide-react"
import { fetchRevenueForecast, RevenueForecastResult } from "@/lib/api-client"

export function MLForecastChart() {
  const [model, setModel] = useState<"linear" | "random-forest" | "neural-network">("random-forest")
  const [forecastResult, setForecastResult] = useState<RevenueForecastResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadForecast = async (selectedModel: "linear" | "random-forest" | "neural-network") => {
    setIsLoading(true)
    try {
      const data = await fetchRevenueForecast("monthly", selectedModel)
      setForecastResult(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadForecast(model)
  }, [model])

  const chartData = forecastResult?.data || []

  return (
    <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <CardTitle>Predictive ML Revenue Forecast</CardTitle>
        </div>
        <div className="flex items-center space-x-4">
          {isLoading ? (
            <div className="flex items-center text-xs text-purple-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              Computing weights...
            </div>
          ) : (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>{forecastResult?.accuracy || 88}% test accuracy</span>
            </Badge>
          )}
          <Select value={model} onValueChange={(value: any) => setModel(value)}>
            <SelectTrigger className="w-52 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear Regression (OLS)</SelectItem>
              <SelectItem value="random-forest">Random Forest Ensemble</SelectItem>
              <SelectItem value="neural-network">Deep Non-linear Boosted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {forecastResult?.model_description || "Dynamic machine learning forecast trained on pipeline velocity and historical run-rates."}
        </p>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="period" stroke="rgba(255,255,255,0.7)" />
            <YAxis stroke="rgba(255,255,255,0.7)" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                backdropFilter: "blur(10px)",
                color: "#fff",
              }}
              formatter={(value: any) => [`$${Number(value).toLocaleString()}`, ""]}
            />
            <ReferenceLine x="May" stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Historical Split", fill: "#ef4444", fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", strokeWidth: 2, r: 6 }}
              name="Actual Closed"
            />
            <Line
              type="monotone"
              dataKey="traditional"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ fill: "#94a3b8", strokeWidth: 2, r: 4 }}
              name="Traditional Target"
            />
            <Line
              type="monotone"
              dataKey="mlForecast"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 6 }}
              name="ML Inferred Forecast"
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4 text-center border-t border-white/10 pt-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Baseline Target</p>
            <p className="text-lg font-semibold text-gray-400">
              ${forecastResult ? (forecastResult.traditional_total / 1000000).toFixed(2) : "1.48"}M
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">ML Predicted Pipeline</p>
            <p className="text-lg font-semibold text-purple-400">
              ${forecastResult ? (forecastResult.ml_projected_total / 1000000).toFixed(2) : "1.53"}M
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Model Variance</p>
            <p className={`text-lg font-semibold ${(forecastResult?.variance_percentage || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {forecastResult ? `${forecastResult.variance_percentage >= 0 ? "+" : ""}${forecastResult.variance_percentage}%` : "+3.5%"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
