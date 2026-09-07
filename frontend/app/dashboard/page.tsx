"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Target, DollarSign, ArrowUp, ArrowDown } from "lucide-react"
import { AIInsightsWidget } from "@/components/ai-insights-widget"
import { AtRiskAccountsPanel } from "@/components/at-risk-accounts-panel"
import { AnimatedCounter } from "@/components/animated-counter"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeads, useDeals, useAdminActivity } from "@/hooks/use-api"
import { useEffect, useState } from "react"
import { fetchRevenueForecast, type RevenueForecastResult } from "@/lib/api-client"

const stageColors: Record<string, string> = {
  prospecting: "#94a3b8",
  qualification: "#3b82f6",
  proposal: "#8b5cf6",
  negotiation: "#06b6d4",
  "closed-won": "#10b981",
  "closed-lost": "#ef4444",
}

export default function DashboardPage() {
  const leads = useLeads()
  const deals = useDeals()
  const activity = useAdminActivity()
  const [forecast, setForecast] = useState<RevenueForecastResult | null>(null)

  useEffect(() => {
    fetchRevenueForecast("monthly", "random-forest").then(setForecast).catch(() => setForecast(null))
  }, [])

  const leadList = leads.data || []
  const dealList = deals.data || []

  const totalPipeline = dealList.reduce((sum, d) => sum + d.value, 0)
  const totalLeads = leadList.length
  const won = dealList.filter((d) => d.stage === "closed-won").length
  const decided = dealList.filter((d) => d.stage === "closed-won" || d.stage === "closed-lost").length
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : dealList.length > 0 ? Math.round(dealList.reduce((s, d) => s + d.probability, 0) / dealList.length) : 0

  const stats = [
    {
      title: "Pipeline Value",
      value: totalPipeline,
      change: "+12.5%",
      trend: "up" as const,
      icon: DollarSign,
      color: "from-green-500 to-emerald-600",
      format: (n: number) => `$${Math.round(n).toLocaleString()}`,
    },
    {
      title: "Active Leads",
      value: totalLeads,
      change: "+8.2%",
      trend: "up" as const,
      icon: Users,
      color: "from-blue-500 to-cyan-600",
    },
    {
      title: "Win Rate",
      value: winRate,
      change: "+2.1%",
      trend: "up" as const,
      icon: Target,
      color: "from-purple-500 to-pink-600",
      format: (n: number) => `${n}%`,
    },
    {
      title: "Open Deals",
      value: dealList.filter((d) => d.stage !== "closed-won" && d.stage !== "closed-lost").length,
      change: "-3.2%",
      trend: "down" as const,
      icon: TrendingUp,
      color: "from-orange-500 to-red-600",
    },
  ]

  // Revenue vs forecast chart data
  const revenueData =
    forecast?.data.map((p) => ({
      month: p.period,
      revenue: p.actual,
      forecast: p.mlForecast,
    })) || []

  // Pipeline distribution
  const stageCounts: Record<string, number> = {}
  dealList.forEach((d) => {
    stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1
  })
  const pipelineData = Object.entries(stageCounts).map(([stage, value]) => ({
    name: stage.replace("-", " "),
    value,
    color: stageColors[stage] || "#3b82f6",
  }))

  const recentActivities = (activity.data || []).slice(0, 6).map((a) => ({
    id: a.id,
    action: a.action,
    user: a.user,
    time: a.timestamp,
  }))

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {leads.isLoading || deals.isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="backdrop-blur-sm bg-white/10 border-white/20">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-24 mb-3" />
                      <Skeleton className="h-8 w-28" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              stats.map((stat, index) => (
                <motion.div
                  key={stat.title}
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
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                          <p className="text-2xl font-bold">
                            <AnimatedCounter value={stat.value} format={stat.format} />
                          </p>
                          <div className="flex items-center mt-2">
                            {stat.trend === "up" ? (
                              <ArrowUp className="w-4 h-4 text-green-500 mr-1" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm ${stat.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                              {stat.change}
                            </span>
                          </div>
                        </div>
                        <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                          <stat.icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <Card className="backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle>Revenue vs Forecast</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.7)" />
                        <YAxis stroke="rgba(255,255,255,0.7)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "8px",
                            backdropFilter: "blur(10px)",
                          }}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="forecast" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Skeleton className="h-[300px] w-full" />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Pipeline Distribution */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
              <Card className="backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle>Pipeline Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pipelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* At-Risk Accounts */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <AtRiskAccountsPanel />
          </motion.div>

          {/* AI Insights */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <AIInsightsWidget />
          </motion.div>

          {/* Recent Activities */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : recentActivities.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivities.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.1 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <p className="font-medium">{item.action}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">by {item.user}</p>
                        </div>
                        <span className="text-sm text-gray-500">{item.time}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No recent activity.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}