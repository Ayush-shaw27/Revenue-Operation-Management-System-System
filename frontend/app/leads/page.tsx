"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { SkeletonGrid } from "@/components/skeleton-card"
import { Search, Plus, Filter, Mail, Phone, Sparkles, Loader2, Trash2, Download, Upload } from "lucide-react"
import { LeadScoreBadge } from "@/components/lead-score-badge"
import { useLeads } from "@/hooks/use-api"
import { createLead, deleteLead, scoreLeadWithML, exportLeadsCSV, type Lead } from "@/lib/api-client"
import { toast } from "sonner"

export default function LeadsPage() {
  const { data: leads, isLoading, error, refetch } = useLeads()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isScoring, setIsScoring] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [previewScore, setPreviewScore] = useState<{ score: number; label: string; factors: string[] } | null>(null)

  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as const,
    source: "Website",
    value: 35000,
    industry: "Technology",
    company_size: "Enterprise",
  })

  const leadList = leads || []

  const filteredLeads = leadList.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "qualified":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
      case "contacted":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
      case "converted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  const handleRunAIScore = async () => {
    setIsScoring(true)
    try {
      const prediction = await scoreLeadWithML({
        name: newLead.name || "Prospect",
        company: newLead.company || "Prospect Corp",
        value: Number(newLead.value) || 30000,
        source: newLead.source,
        industry: newLead.industry,
        company_size: newLead.company_size,
        touchpoints: 3,
      })
      setPreviewScore(prediction)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsScoring(false)
    }
  }

  const handleAddLead = async () => {
    setIsScoring(true)
    try {
      let score = previewScore?.score
      let factors = previewScore?.factors

      if (!score || !factors) {
        const pred = await scoreLeadWithML({
          name: newLead.name,
          company: newLead.company,
          value: Number(newLead.value),
          source: newLead.source,
          industry: newLead.industry,
          company_size: newLead.company_size,
          touchpoints: 3,
        })
        score = pred.score
        factors = pred.factors
      }

      await createLead({
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        company: newLead.company,
        status: newLead.status,
        source: newLead.source,
        value: Number(newLead.value),
        industry: newLead.industry,
        company_size: newLead.company_size,
        ai_score: score,
        ai_label: previewScore?.label,
        ai_factors: factors,
      })
      toast.success("Lead created and scored")
      await refetch()
      setNewLead({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "new",
        source: "Website",
        value: 35000,
        industry: "Technology",
        company_size: "Enterprise",
      })
      setPreviewScore(null)
      setIsAddModalOpen(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsScoring(false)
    }
  }

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteLead(id)
      toast.success("Lead deleted")
      await refetch()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleExport = async () => {
    try {
      const csv = await exportLeadsCSV()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "leads.csv"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Leads exported")
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleImport = async (file: File) => {
    setIsImporting(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const token = typeof window !== "undefined" ? localStorage.getItem("revops_token") : null
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/leads/import`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        }
      )
      const result = await res.json()
      if (!res.ok) throw new Error(result.detail || "Import failed")
      toast.success(`Imported ${result.created} leads${result.errors.length ? `, ${result.errors.length} errors` : ""}`)
      await refetch()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold">Leads Management</h1>
              <p className="text-gray-600 dark:text-gray-400">
                AI-Powered Lead Prioritization and Conversion Analytics
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Export */}
              <Button variant="outline" size="sm" onClick={handleExport} className="backdrop-blur-sm bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              {/* Import */}
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImport(file)
                    e.target.value = ""
                  }}
                />
                <Button variant="outline" size="sm" asChild disabled={isImporting} className="backdrop-blur-sm bg-transparent">
                  <span>
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Import CSV
                  </span>
                </Button>
              </label>

              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Lead & AI Score
                    </Button>
                  </motion.div>
                </DialogTrigger>
                <DialogContent className="backdrop-blur-xl bg-slate-900/90 border-white/20 text-white max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" /> Add New Lead with ML Scoring
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Contact Name</Label>
                        <Input
                          id="name"
                          placeholder="Alice Smith"
                          value={newLead.name}
                          onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                      <div>
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          placeholder="Apex Technologies"
                          value={newLead.company}
                          onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="alice@apex.com"
                          value={newLead.email}
                          onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          placeholder="+1 (555) 432-1098"
                          value={newLead.phone}
                          onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="source">Lead Source</Label>
                        <Select
                          value={newLead.source}
                          onValueChange={(val) => setNewLead({ ...newLead, source: val })}
                        >
                          <SelectTrigger className="backdrop-blur-sm bg-white/10 border-white/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Website">Website Inbound</SelectItem>
                            <SelectItem value="Referral">Executive Referral</SelectItem>
                            <SelectItem value="LinkedIn">LinkedIn Outreach</SelectItem>
                            <SelectItem value="Email Campaign">Email Campaign</SelectItem>
                            <SelectItem value="Event">Industry Summit / Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="value">Deal Value ($)</Label>
                        <Input
                          id="value"
                          type="number"
                          value={newLead.value}
                          onChange={(e) => setNewLead({ ...newLead, value: Number(e.target.value) || 0 })}
                          className="backdrop-blur-sm bg-white/10 border-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="size">Company Tier</Label>
                        <Select
                          value={newLead.company_size}
                          onValueChange={(val) => setNewLead({ ...newLead, company_size: val })}
                        >
                          <SelectTrigger className="backdrop-blur-sm bg-white/10 border-white/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Enterprise">Enterprise ($100M+)</SelectItem>
                            <SelectItem value="Mid-Market">Mid-Market</SelectItem>
                            <SelectItem value="Startup">Early Stage Startup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleRunAIScore}
                          disabled={isScoring}
                          className="w-full bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30"
                        >
                          {isScoring ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                          )}
                          Simulate AI Score
                        </Button>
                      </div>
                    </div>

                    {previewScore && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-white/10 border border-purple-500/40 text-sm space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Predicted AI Score:</span>
                          <LeadScoreBadge score={previewScore.score} factors={previewScore.factors} />
                        </div>
                        <p className="text-xs text-purple-300">Top Factors: {previewScore.factors.join(" • ")}</p>
                      </motion.div>
                    )}

                    <Button
                      onClick={handleAddLead}
                      disabled={isScoring || !newLead.name || !newLead.company}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      Save & Score Lead
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search leads by name, company, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 backdrop-blur-sm bg-white/10 border-white/20"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 backdrop-blur-sm bg-white/10 border-white/20">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Leads Grid */}
          {isLoading ? (
            <SkeletonGrid count={6} />
          ) : error ? (
            <div className="text-center py-12 text-red-500">{error}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredLeads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, rotateY: 3 }}
                    style={{ perspective: "1000px" }}
                  >
                    <Card className="backdrop-blur-sm bg-white/10 border-white/20 hover:bg-white/15 transition-all duration-300">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{lead.name}</CardTitle>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{lead.company}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteLead(lead.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        </div>
                        {lead.ai_score !== undefined && lead.ai_score !== null && (
                          <div className="pt-2">
                            <LeadScoreBadge score={lead.ai_score} factors={lead.ai_factors || []} />
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {lead.email}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {lead.phone}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">
                            Value: <strong className="text-foreground">${Number(lead.value).toLocaleString()}</strong>
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {lead.source}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {!isLoading && filteredLeads.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No leads found matching your criteria.</p>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}