"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Target, DollarSign, ArrowUp, ArrowDown } from "lucide-react"
import { AIInsightsWidget } from "@/components/ai-insights-widget"

const revenueData = [
  { month: "Jan", revenue: 45000, forecast: 42000 },
  { month: "Feb", revenue: 52000, forecast: 48000 },
  { month: "Mar", revenue: 48000, forecast: 50000 },
  { month: "Apr", revenue: 61000, forecast: 55000 },
  { month: "May", revenue: 55000, forecast: 58000 },
  { month: "Jun", revenue: 67000, forecast: 62000 },
]

const pipelineData = [
  { name: "Qualified", value: 35, color: "#3b82f6" },
  { name: "Proposal", value: 25, color: "#8b5cf6" },
  { name: "Negotiation", value: 20, color: "#06b6d4" },
  { name: "Closed Won", value: 20, color: "#10b981" },
]

export default function DashboardPage() {
  const stats = [
    {
      title: "Total Revenue",
      value: "$328,000",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Active Leads",
      value: "1,247",
      change: "+8.2%",
      trend: "up",
      icon: Users,
      color: "from-blue-500 to-cyan-600",
    },
    {
      title: "Win Rate",
      value: "68%",
      change: "+2.1%",
      trend: "up",
      icon: Target,
      color: "from-purple-500 to-pink-600",
    },
    {
      title: "Pipeline Value",
      value: "$892,000",
      change: "-3.2%",
      trend: "down",
      icon: TrendingUp,
      color: "from-orange-500 to-red-600",
    },
  ]

  const recentActivities = [
    { id: 1, action: "New lead created", user: "Sarah Johnson", time: "2 minutes ago" },
    { id: 2, action: "Deal moved to negotiation", user: "Mike Chen", time: "15 minutes ago" },
    { id: 3, action: "Meeting scheduled", user: "Emily Davis", time: "1 hour ago" },
    { id: 4, action: "Proposal sent", user: "David Wilson", time: "2 hours ago" },
    { id: 5, action: "Lead qualified", user: "Lisa Anderson", time: "3 hours ago" },
  ]

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
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
                        <p className="text-2xl font-bold">{stat.value}</p>
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
                      <div
                        className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}
                      >
                        <stat.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
                        label={({ name, value }) => `${name}: ${value}%`}
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
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">by {activity.user}</p>
                      </div>
                      <span className="text-sm text-gray-500">{activity.time}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}
