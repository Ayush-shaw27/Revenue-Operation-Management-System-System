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
import { Search, Plus, Filter, Mail, Phone } from "lucide-react"
import { LeadScoreBadge } from "@/components/lead-score-badge"
import { toast } from "sonner"

interface Lead {
  id: number
  name: string
  email: string
  phone: string
  company: string
  status: "new" | "qualified" | "contacted" | "converted"
  source: string
  value: number
  createdAt: string
  aiScore: number
  aiFactors: string[]
}

const initialLeads: Lead[] = [
  {
    id: 1,
    name: "John Smith",
    email: "john@acme.com",
    phone: "+1 (555) 123-4567",
    company: "Acme Corp",
    status: "qualified",
    source: "Website",
    value: 25000,
    createdAt: "2024-01-15",
    aiScore: 87,
    aiFactors: ["High engagement", "Enterprise size", "Budget confirmed"],
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah@techstart.com",
    phone: "+1 (555) 987-6543",
    company: "TechStart Inc",
    status: "new",
    source: "LinkedIn",
    value: 45000,
    createdAt: "2024-01-14",
    aiScore: 72,
    aiFactors: ["Tech industry", "Growing company", "Multiple touchpoints"],
  },
  {
    id: 3,
    name: "Mike Chen",
    email: "mike@innovate.io",
    phone: "+1 (555) 456-7890",
    company: "Innovate.io",
    status: "contacted",
    source: "Referral",
    value: 35000,
    createdAt: "2024-01-13",
    aiScore: 94,
    aiFactors: ["Warm referral", "Immediate need", "Decision maker"],
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily@growth.co",
    phone: "+1 (555) 321-0987",
    company: "Growth Co",
    status: "converted",
    source: "Email Campaign",
    value: 55000,
    createdAt: "2024-01-12",
    aiScore: 96,
    aiFactors: ["Converted successfully", "High value", "Quick decision"],
  },
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as const,
    source: "",
    value: 0,
  })

  const filteredLeads = leads.filter((lead) => {
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

  const generateAIScore = () => {
    return Math.floor(Math.random() * 40) + 60 // Random score between 60-100
  }

  const generateAIFactors = (company: string, source: string) => {
    const factors = [
      "High engagement rate",
      "Enterprise company size",
      "Budget confirmed",
      "Decision maker identified",
      "Immediate need expressed",
      "Multiple touchpoints",
      "Warm referral",
      "Industry match",
      "Previous customer",
      "Active on social media",
    ]
    return factors.slice(0, Math.floor(Math.random() * 3) + 2)
  }

  const handleAddLead = () => {
    if (!newLead.name || !newLead.email || !newLead.company) {
      toast.error("Please fill in all required fields")
      return
    }

    const lead: Lead = {
      id: leads.length + 1,
      ...newLead,
      createdAt: new Date().toISOString().split("T")[0],
      aiScore: generateAIScore(),
      aiFactors: generateAIFactors(newLead.company, newLead.source),
    }

    setLeads([lead, ...leads])
    setNewLead({
      name: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
      source: "",
      value: 0,
    })
    setIsAddModalOpen(false)
    toast.success(`Lead ${lead.name} added successfully!`)
  }

  const handleEmailLead = (lead: Lead) => {
    // Simulate email composition
    const subject = `Follow up - ${lead.company}`
    const body = `Hi ${lead.name},\n\nI wanted to follow up on our previous conversation about your needs at ${lead.company}.\n\nBest regards,\nSales Team`

    // In a real app, this would open email client or send via API
    toast.success(`Email draft created for ${lead.name}`)
    console.log(`Email to: ${lead.email}\nSubject: ${subject}\nBody: ${body}`)
  }

  const handleCallLead = (lead: Lead) => {
    // Simulate call initiation
    toast.success(`Initiating call to ${lead.name} at ${lead.phone}`)

    // In a real app, this would integrate with phone system
    console.log(`Calling ${lead.name} at ${lead.phone}`)
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Leads Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Track and manage your sales leads</p>
            </div>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Lead
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="backdrop-blur-xl bg-white/10 border-white/20">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={newLead.name}
                        onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                        className="backdrop-blur-sm bg-white/10 border-white/20"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company *</Label>
                      <Input
                        id="company"
                        value={newLead.company}
                        onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                        className="backdrop-blur-sm bg-white/10 border-white/20"
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                      className="backdrop-blur-sm bg-white/10 border-white/20"
                      placeholder="email@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      className="backdrop-blur-sm bg-white/10 border-white/20"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="source">Source</Label>
                      <Select
                        value={newLead.source}
                        onValueChange={(value) => setNewLead({ ...newLead, source: value })}
                      >
                        <SelectTrigger className="backdrop-blur-sm bg-white/10 border-white/20">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Email Campaign">Email Campaign</SelectItem>
                          <SelectItem value="Cold Call">Cold Call</SelectItem>
                          <SelectItem value="Trade Show">Trade Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="value">Potential Value ($)</Label>
                      <Input
                        id="value"
                        type="number"
                        value={newLead.value}
                        onChange={(e) => setNewLead({ ...newLead, value: Number.parseInt(e.target.value) || 0 })}
                        className="backdrop-blur-sm bg-white/10 border-white/20"
                        placeholder="25000"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleAddLead} className="flex-1">
                      Add Lead
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 bg-transparent"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search leads by name, company, or email..."
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
                    <SelectItem value="all">All Status</SelectItem>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredLeads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, rotateY: 5 }}
                  style={{ perspective: "1000px" }}
                >
                  <Card className="backdrop-blur-sm bg-white/10 border-white/20 hover:bg-white/20 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <CardTitle className="text-lg">{lead.name}</CardTitle>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{lead.company}</p>
                        </div>
                        <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <LeadScoreBadge score={lead.aiScore} factors={lead.aiFactors} />
                        <span className="text-xs text-gray-500">Source: {lead.source}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4 mr-2" />
                        {lead.email}
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4 mr-2" />
                        {lead.phone}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Value: ${lead.value.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">{lead.createdAt}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => handleEmailLead(lead)}
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => handleCallLead(lead)}
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          Call
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredLeads.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No leads found matching your criteria.</p>
              <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
                Add Your First Lead
              </Button>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}
