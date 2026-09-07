"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { useAnalyticsFunnel, useAnalyticsCohorts } from "@/hooks/use-api"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Filter, RefreshCw } from "lucide-react"

export default function AnalyticsPage() {
  const [by, setBy] = useState<"source" | "stage">("source")
  const funnel = useAnalyticsFunnel(by)
  const cohorts = useAnalyticsCohorts()

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400">Funnel and cohort breakdowns</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={by} onValueChange={(v) => setBy(v as "source" | "stage")}>
                <SelectTrigger className="w-44 backdrop-blur-sm bg-white/10 border-white/20 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source">By Source</SelectItem>
                  <SelectItem value="stage">By Stage</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={funnel.refetch} className="h-8 w-8 p-0">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Funnel Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle>Funnel {by === "source" ? "by Lead Source" : "by Lead Stage"}</CardTitle>
              </CardHeader>
              <CardContent>
                {funnel.isLoading ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : funnel.error ? (
                  <p className="text-red-500 text-sm">{funnel.error}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={funnel.data?.funnel || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                      <YAxis stroke="rgba(255,255,255,0.7)" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.85)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {(funnel.data?.funnel || []).map((entry, idx) => (
                          <Cell key={idx} fill={entry.color || "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Cohort table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle>Monthly Cohorts</CardTitle>
              </CardHeader>
              <CardContent>
                {cohorts.isLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : cohorts.error ? (
                  <p className="text-red-500 text-sm">{cohorts.error}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20">
                        <TableHead className="text-gray-300">Cohort</TableHead>
                        <TableHead className="text-gray-300">Total Leads</TableHead>
                        <TableHead className="text-gray-300">Converted</TableHead>
                        <TableHead className="text-gray-300">Conversion Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(cohorts.data || []).map((c) => (
                        <TableRow key={c.cohort} className="border-white/20 hover:bg-white/5">
                          <TableCell className="text-white font-medium">{c.cohort}</TableCell>
                          <TableCell className="text-gray-300">{c.total}</TableCell>
                          <TableCell className="text-gray-300">{c.converted}</TableCell>
                          <TableCell className="text-gray-300">{c.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {(cohorts.data || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500 py-6">
                            No cohort data available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}