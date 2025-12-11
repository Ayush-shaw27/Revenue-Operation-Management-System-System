"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts"
import { TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react"
import { MLForecastChart } from "@/components/ml-forecast-chart"
import { ForecastAPIIntegration } from "@/components/forecast-api-integration"

const monthlyData = [
  { period: "Jan", actual: 145000, forecast: 140000, target: 150000 },
  { period: "Feb", actual: 162000, forecast: 155000, target: 160000 },
  { period: "Mar", actual: 158000, forecast: 165000, target: 170000 },
  { period: "Apr", actual: 189000, forecast: 180000, target: 180000 },
  { period: "May", actual: 195000, forecast: 190000, target: 190000 },
  { period: "Jun", actual: 0, forecast: 205000, target: 200000 },
  { period: "Jul", actual: 0, forecast: 215000, target: 210000 },
  { period: "Aug", actual: 0, forecast: 225000, target: 220000 },
]

const quarterlyData = [
  { period: "Q1 2024", actual: 465000, forecast: 460000, target: 480000 },
  { period: "Q2 2024", actual: 384000, forecast: 595000, target: 570000 },
  { period: "Q3 2024", actual: 0, forecast: 640000, target: 630000 },
  { period: "Q4 2024", actual: 0, forecast: 685000, target: 680000 },
]

const yearlyData = [
  { period: "2022", actual: 1850000, forecast: 1800000, target: 1900000 },
  { period: "2023", actual: 2150000, forecast: 2100000, target: 2200000 },
  { period: "2024", actual: 849000, forecast: 2380000, target: 2360000 },
  { period: "2025", actual: 0, forecast: 2650000, target: 2600000 },
]

export default function ForecastPage() {
  const [timeframe, setTimeframe] = useState<"monthly" | "quarterly" | "yearly">("monthly")

  const getCurrentData = () => {
    switch (timeframe) {
      case "monthly":
        return monthlyData
      case "quarterly":
        return quarterlyData
      case "yearly":
        return yearlyData
      default:
        return monthlyData
    }
  }

  const getMetrics = () => {
    const data = getCurrentData()
    const currentPeriod = data.find((d) => d.actual > 0) || data[0]
    const totalActual = data.reduce((sum, d) => sum + d.actual, 0)
    const totalForecast = data.reduce((sum, d) => sum + d.forecast, 0)
    const totalTarget = data.reduce((sum, d) => sum + d.target, 0)

    return {
      currentRevenue: totalActual,
      forecastedRevenue: totalForecast,
      targetRevenue: totalTarget,
      variance: (((totalForecast - totalTarget) / totalTarget) * 100).toFixed(1),
    }
  }

  const metrics = getMetrics()

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Revenue Forecast</h1>
              <p className="text-gray-600 dark:text-gray-400">Track and predict revenue performance</p>
            </div>

            <Select
              value={timeframe}
              onValueChange={(value: "monthly" | "quarterly" | "yearly") => setTimeframe(value)}
            >
              <SelectTrigger className="w-48 backdrop-blur-sm bg-white/10 border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly View</SelectItem>
                <SelectItem value="quarterly">Quarterly View</SelectItem>
                <SelectItem value="yearly">Yearly View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Current Revenue",
                value: `$${metrics.currentRevenue.toLocaleString()}`,
                icon: DollarSign,
                color: "from-green-500 to-emerald-600",
                change: "+12.5%",
              },
              {
                title: "Forecasted Revenue",
                value: `$${metrics.forecastedRevenue.toLocaleString()}`,
                icon: TrendingUp,
                color: "from-blue-500 to-cyan-600",
                change: "+8.3%",
              },
              {
                title: "Target Revenue",
                value: `$${metrics.targetRevenue.toLocaleString()}`,
                icon: Target,
                color: "from-purple-500 to-pink-600",
                change: "Target",
              },
              {
                title: "Variance",
                value: `${metrics.variance}%`,
                icon: Number.parseFloat(metrics.variance) >= 0 ? TrendingUp : TrendingDown,
                color:
                  Number.parseFloat(metrics.variance) >= 0
                    ? "from-green-500 to-emerald-600"
                    : "from-red-500 to-rose-600",
                change: Number.parseFloat(metrics.variance) >= 0 ? "Above Target" : "Below Target",
              },
            ].map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, rotateY: 5 }}
                style={{ perspective: "1000px" }}
              >
                <Card className="backdrop-blur-sm bg-white/10 border-white/20 hover:bg-white/20 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.title}</p>
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <p className="text-sm text-gray-500 mt-1">{metric.change}</p>
                      </div>
                      <div
                        className={`w-12 h-12 bg-gradient-to-r ${metric.color} rounded-lg flex items-center justify-center`}
                      >
                        <metric.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* AI-Powered Forecast Integration */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <ForecastAPIIntegration />
          </motion.div>

          {/* ML Forecast Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <MLForecastChart />
          </motion.div>

          {/* Traditional Forecast Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border-white/20 dark:border-gray-700/20">
              <CardHeader>
                <CardTitle>Traditional Revenue Forecast vs Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={getCurrentData()}>
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
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: "#10b981", strokeWidth: 2, r: 6 }}
                      name="Actual"
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                      name="Forecast"
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      name="Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Secondary Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Trend */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
              <Card className="backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle>Performance Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={getCurrentData()}>
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
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke="#3b82f6"
                        fill="url(#colorForecast)"
                        fillOpacity={0.3}
                      />
                      <defs>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Variance Analysis */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
              <Card className="backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle>Variance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={getCurrentData().map((d) => ({
                        ...d,
                        variance: d.forecast - d.target,
                      }))}
                    >
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
                      <Bar dataKey="variance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}
