"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Calendar, User, MoreHorizontal, Plus, Loader2 } from "lucide-react"
import { useDeals, useAnomalies, useNextBestActions } from "@/hooks/use-api"
import { updateDeal, createDeal, type Deal } from "@/lib/api-client"
import { NextBestActionCard } from "@/components/next-best-action-card"
import { AnomalyWarningBadge } from "@/components/anomaly-warning-badge"
import { toast } from "sonner"

const stages = [
  { id: "prospecting", title: "Prospecting", color: "from-gray-500 to-gray-600" },
  { id: "qualification", title: "Qualification", color: "from-blue-500 to-blue-600" },
  { id: "proposal", title: "Proposal", color: "from-yellow-500 to-yellow-600" },
  { id: "negotiation", title: "Negotiation", color: "from-purple-500 to-purple-600" },
  { id: "closed-won", title: "Closed Won", color: "from-green-500 to-green-600" },
  { id: "closed-lost", title: "Closed Lost", color: "from-red-500 to-red-600" },
]

export default function PipelinePage() {
  const { data: deals, isLoading, error, refetch } = useDeals()
  const anomalies = useAnomalies()
  const actions = useNextBestActions()
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newDeal, setNewDeal] = useState({
    title: "",
    company: "",
    value: 50000,
    probability: 50,
    stage: "prospecting",
  })

  const dealList = deals || []

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    if (draggedDeal) {
      const prev = dealtStage(draggedDeal.id)
      // optimistic update
      refetch()
      try {
        await updateDeal(draggedDeal.id, { stage: newStage })
        toast.success(`Moved to ${newStage}`)
      } catch (err: any) {
        toast.error(err.message)
      }
      setDraggedDeal(null)
    }
  }

  const dealtStage = (id: string) => {
    return dealList.find((d) => d.id === id)?.stage
  }

  const getDealsForStage = (stageId: string) => {
    return dealList.filter((deal) => deal.stage === stageId)
  }

  const getTotalValue = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + deal.value, 0)
  }

  const anomalyMap: Record<string, { is_anomalous: boolean; reasons: string[] }> = {}
  ;(anomalies.data || []).forEach((a) => {
    anomalyMap[a.deal_id] = { is_anomalous: a.is_anomalous, reasons: a.reasons }
  })

  const actionMap: Record<string, any[]> = {}
  ;(actions.data || []).forEach((nba) => {
    actionMap[nba.deal_id] = nba.recommendations
  })

  const handleAddDeal = async () => {
    if (!newDeal.title || !newDeal.company) return
    setIsAdding(true)
    try {
      await createDeal({
        title: newDeal.title,
        company: newDeal.company,
        value: Number(newDeal.value) || 0,
        probability: Number(newDeal.probability) || 50,
        stage: newDeal.stage,
      })
      toast.success("Deal created")
      setIsAddOpen(false)
      setNewDeal({ title: "", company: "", value: 50000, probability: 50, stage: "prospecting" })
      await refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Sales Pipeline</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage deals through your sales process</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Pipeline Value</p>
                <p className="text-2xl font-bold">${dealList.reduce((sum, deal) => sum + deal.value, 0).toLocaleString()}</p>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Deal
                  </Button>
                </DialogTrigger>
                <DialogContent className="backdrop-blur-xl bg-slate-900/90 border-white/20 text-white max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Deal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="deal-title">Deal Title</Label>
                      <Input
                        id="deal-title"
                        placeholder="Enterprise License"
                        value={newDeal.title}
                        onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                        className="backdrop-blur-sm bg-white/10 border-white/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deal-company">Company</Label>
                      <Input
                        id="deal-company"
                        placeholder="Acme Corp"
                        value={newDeal.company}
                        onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                        className="backdrop-blur-sm bg-white/10 border-white/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="deal-value">Value ($)</Label>
                        <Input
                          id="deal-value"
                          type="number"
                          value={newDeal.value}
                          onChange={(e) => setNewDeal({ ...newDeal, value: Number(e.target.value) || 0 })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                      <div>
                        <Label htmlFor="deal-prob">Probability (%)</Label>
                        <Input
                          id="deal-prob"
                          type="number"
                          value={newDeal.probability}
                          onChange={(e) => setNewDeal({ ...newDeal, probability: Number(e.target.value) || 0 })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Stage</Label>
                      <Select
                        value={newDeal.stage}
                        onValueChange={(val) => setNewDeal({ ...newDeal, stage: val })}
                      >
                        <SelectTrigger className="backdrop-blur-sm bg-white/10 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAddDeal}
                      disabled={isAdding || !newDeal.title || !newDeal.company}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Deal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Pipeline Board */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
              {stages.map((s) => (
                <div key={s.id} className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">{error}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 min-h-[600px]">
              {stages.map((stage, stageIndex) => (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: stageIndex * 0.1 }}
                  className="space-y-4"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {/* Stage Header */}
                  <Card className="backdrop-blur-sm bg-white/10 border-white/20">
                    <CardHeader className="pb-3">
                      <div className={`w-full h-2 bg-gradient-to-r ${stage.color} rounded-full mb-2`} />
                      <CardTitle className="text-sm font-medium">{stage.title}</CardTitle>
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>{getDealsForStage(stage.id).length} deals</span>
                        <span>${getTotalValue(stage.id).toLocaleString()}</span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Deals */}
                  <div className="space-y-3">
                    <AnimatePresence>
                      {getDealsForStage(stage.id).map((deal, dealIndex) => {
                        const anomaly = anomalyMap[deal.id]
                        const recs = actionMap[deal.id] || []
                        return (
                          <motion.div
                            key={deal.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: dealIndex * 0.05 }}
                            whileHover={{ scale: 1.02, rotateY: 5 }}
                            whileDrag={{ scale: 1.05, rotateZ: 5 }}
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            onDragStart={() => handleDragStart(deal)}
                            style={{ perspective: "1000px" }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <Card className="backdrop-blur-sm bg-white/10 border-white/20 hover:bg-white/20 transition-all duration-300">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-semibold text-sm leading-tight">{deal.title}</h3>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-gray-600 dark:text-gray-400">{deal.company}</p>
                                  {anomaly?.is_anomalous && <AnomalyWarningBadge reasons={anomaly.reasons} />}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center">
                                      <DollarSign className="w-3 h-3 mr-1" />
                                      <span className="font-medium">${deal.value.toLocaleString()}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs px-2 py-0">
                                      {deal.probability}%
                                    </Badge>
                                  </div>

                                  <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                    <User className="w-3 h-3 mr-1" />
                                    <span>{deal.owner}</span>
                                  </div>

                                  {deal.close_date && (
                                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      <span>{new Date(deal.close_date).toLocaleDateString()}</span>
                                    </div>
                                  )}

                                  {/* Progress Bar */}
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                                      style={{ width: `${deal.probability}%` }}
                                    />
                                  </div>

                                  {/* Next Best Actions */}
                                  <NextBestActionCard recommendations={recs} />
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Drop Zone Indicator */}
                  {draggedDeal && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-2 border-dashed border-blue-400 rounded-lg p-4 text-center text-sm text-blue-400"
                    >
                      Drop here to move to {stage.title}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}