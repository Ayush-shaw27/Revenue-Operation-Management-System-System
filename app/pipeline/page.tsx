"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { DollarSign, Calendar, User, Plus, Edit, Trash2, MessageSquare, Send, AtSign, Clock } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

interface Deal {
  id: number
  title: string
  company: string
  value: number
  probability: number
  owner: string
  closeDate: string
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed-won" | "closed-lost"
  notes?: string
  comments: Comment[]
  activities: Activity[]
}

interface Comment {
  id: number
  author: string
  content: string
  timestamp: string
  mentions: string[]
}

interface Activity {
  id: number
  user: string
  action: string
  timestamp: string
}

const initialDeals: Deal[] = [
  {
    id: 1,
    title: "Enterprise Software License",
    company: "Acme Corp",
    value: 125000,
    probability: 75,
    owner: "John Smith",
    closeDate: "2024-02-15",
    stage: "negotiation",
    notes: "Final pricing discussion scheduled",
    comments: [
      {
        id: 1,
        author: "John Smith",
        content: "Had a great call with @Sarah Johnson about pricing. They're ready to move forward.",
        timestamp: "2024-01-19 14:30",
        mentions: ["Sarah Johnson"],
      },
      {
        id: 2,
        author: "Sarah Johnson",
        content: "Thanks @John Smith! I'll prepare the final contract for review.",
        timestamp: "2024-01-19 15:45",
        mentions: ["John Smith"],
      },
    ],
    activities: [
      { id: 1, user: "John Smith", action: "moved deal to negotiation", timestamp: "2024-01-19 10:00" },
      { id: 2, user: "Sarah Johnson", action: "updated deal probability to 75%", timestamp: "2024-01-19 11:30" },
    ],
  },
  {
    id: 2,
    title: "Cloud Migration Project",
    company: "TechStart Inc",
    value: 85000,
    probability: 60,
    owner: "Sarah Johnson",
    closeDate: "2024-02-28",
    stage: "proposal",
    notes: "Proposal submitted, awaiting feedback",
    comments: [],
    activities: [],
  },
  {
    id: 3,
    title: "Digital Transformation",
    company: "Innovate.io",
    value: 200000,
    probability: 40,
    owner: "Mike Chen",
    closeDate: "2024-03-10",
    stage: "qualification",
    notes: "Budget approval in progress",
    comments: [],
    activities: [],
  },
  {
    id: 4,
    title: "Security Audit Service",
    company: "SecureTech",
    value: 45000,
    probability: 90,
    owner: "Emily Davis",
    closeDate: "2024-02-05",
    stage: "negotiation",
    notes: "Contract review phase",
    comments: [],
    activities: [],
  },
  {
    id: 5,
    title: "Marketing Automation",
    company: "Growth Co",
    value: 65000,
    probability: 25,
    owner: "David Wilson",
    closeDate: "2024-03-20",
    stage: "prospecting",
    notes: "Initial contact made",
    comments: [],
    activities: [],
  },
]

const stages = [
  { id: "prospecting", title: "Prospecting", color: "from-gray-500 to-gray-600" },
  { id: "qualification", title: "Qualification", color: "from-blue-500 to-blue-600" },
  { id: "proposal", title: "Proposal", color: "from-yellow-500 to-yellow-600" },
  { id: "negotiation", title: "Negotiation", color: "from-purple-500 to-purple-600" },
  { id: "closed-won", title: "Closed Won", color: "from-green-500 to-green-600" },
  { id: "closed-lost", title: "Closed Lost", color: "from-red-500 to-red-600" },
]

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedDealForComments, setSelectedDealForComments] = useState<Deal | null>(null)
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([])

  const teamMembers = ["John Smith", "Sarah Johnson", "Mike Chen", "Emily Davis", "David Wilson"]

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    if (draggedDeal) {
      const updatedDeals = deals.map((deal) =>
        deal.id === draggedDeal.id ? { ...deal, stage: newStage as Deal["stage"] } : deal,
      )
      setDeals(updatedDeals)
      setDraggedDeal(null)

      // Show success message
      const stageName = stages.find((s) => s.id === newStage)?.title
      toast.success(`Deal "${draggedDeal.title}" moved to ${stageName}`)
    }
  }

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal)
    setIsDetailModalOpen(true)
  }

  const handleEditDeal = (deal: Deal) => {
    // In a real app, this would open an edit modal
    toast.info(`Edit functionality for "${deal.title}" would open here`)
  }

  const handleDeleteDeal = (dealId: number) => {
    const dealToDelete = deals.find((d) => d.id === dealId)
    setDeals(deals.filter((deal) => deal.id !== dealId))
    toast.success(`Deal "${dealToDelete?.title}" deleted successfully`)
  }

  const handleAddDeal = (stageId: string) => {
    // In a real app, this would open an add deal modal
    const stageName = stages.find((s) => s.id === stageId)?.title
    toast.info(`Add new deal to ${stageName} stage functionality would open here`)
  }

  const handleAddComment = (dealId: number) => {
    if (!newComment.trim()) return

    const mentions = extractMentions(newComment)
    const comment: Comment = {
      id: Date.now(),
      author: "Current User", // In real app, get from auth
      content: newComment,
      timestamp: new Date().toISOString(),
      mentions,
    }

    const activity: Activity = {
      id: Date.now(),
      user: "Current User",
      action: "added a comment",
      timestamp: new Date().toISOString(),
    }

    setDeals(
      deals.map((deal) =>
        deal.id === dealId
          ? {
              ...deal,
              comments: [...deal.comments, comment],
              activities: [activity, ...deal.activities],
            }
          : deal,
      ),
    )

    setNewComment("")
    toast.success("Comment added successfully")

    // Notify mentioned users
    if (mentions.length > 0) {
      toast.info(`Mentioned: ${mentions.join(", ")}`)
    }
  }

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+\s?\w*)/g
    const matches = text.match(mentionRegex)
    return matches ? matches.map((match) => match.substring(1)) : []
  }

  const handleCommentChange = (value: string) => {
    setNewComment(value)

    // Show mention suggestions when @ is typed
    const lastAtIndex = value.lastIndexOf("@")
    if (lastAtIndex !== -1) {
      const searchTerm = value.substring(lastAtIndex + 1).toLowerCase()
      const suggestions = teamMembers.filter((member) => member.toLowerCase().includes(searchTerm))
      setMentionSuggestions(suggestions)
    } else {
      setMentionSuggestions([])
    }
  }

  const insertMention = (member: string) => {
    const lastAtIndex = newComment.lastIndexOf("@")
    const beforeMention = newComment.substring(0, lastAtIndex)
    const afterMention = newComment.substring(newComment.length)
    setNewComment(`${beforeMention}@${member} ${afterMention}`)
    setMentionSuggestions([])
  }

  const getDealsForStage = (stageId: string) => {
    return deals.filter((deal) => deal.stage === stageId)
  }

  const getTotalValue = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + deal.value, 0)
  }

  const getWeightedValue = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + (deal.value * deal.probability) / 100, 0)
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
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Pipeline Value</p>
              <p className="text-2xl font-bold">${deals.reduce((sum, deal) => sum + deal.value, 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">
                Weighted: $
                {Math.round(
                  deals.reduce((sum, deal) => sum + (deal.value * deal.probability) / 100, 0),
                ).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Pipeline Board */}
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{stage.title}</CardTitle>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleAddDeal(stage.id)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>{getDealsForStage(stage.id).length} deals</span>
                        <span>${getTotalValue(stage.id).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-green-600 dark:text-green-400">
                          Weighted: ${Math.round(getWeightedValue(stage.id)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Deals */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {getDealsForStage(stage.id).map((deal, dealIndex) => (
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
                            <div className="flex justify-between items-start mb-3">
                              <h3
                                className="font-semibold text-sm leading-tight cursor-pointer hover:text-blue-500"
                                onClick={() => handleDealClick(deal)}
                              >
                                {deal.title}
                              </h3>
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEditDeal(deal)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setSelectedDealForComments(deal)
                                    setIsCommentsModalOpen(true)
                                  }}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {deal.comments.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                      {deal.comments.length}
                                    </span>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteDeal(deal.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{deal.company}</p>

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

                              <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                <Calendar className="w-3 h-3 mr-1" />
                                <span>{new Date(deal.closeDate).toLocaleDateString()}</span>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${deal.probability}%` }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
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
        </div>

        {/* Deal Detail Modal */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="backdrop-blur-xl bg-white/10 border-white/20 max-w-md">
            <DialogHeader>
              <DialogTitle>Deal Details</DialogTitle>
            </DialogHeader>
            {selectedDeal && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedDeal.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedDeal.company}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Value</p>
                    <p className="font-semibold">${selectedDeal.value.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Probability</p>
                    <p className="font-semibold">{selectedDeal.probability}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Owner</p>
                    <p className="font-semibold">{selectedDeal.owner}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Close Date</p>
                    <p className="font-semibold">{new Date(selectedDeal.closeDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedDeal.notes && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
                    <p className="text-sm bg-white/5 p-2 rounded">{selectedDeal.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setIsDetailModalOpen(false)
                      handleEditDeal(selectedDeal)
                    }}
                  >
                    Edit Deal
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Collaboration Modal */}
        <Dialog open={isCommentsModalOpen} onOpenChange={setIsCommentsModalOpen}>
          <DialogContent className="backdrop-blur-xl bg-white/10 border-white/20 max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Collaboration - {selectedDealForComments?.title}</span>
              </DialogTitle>
            </DialogHeader>

            {selectedDealForComments && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Deal Summary */}
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{selectedDealForComments.company}</h4>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      ${selectedDealForComments.value.toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Owner: {selectedDealForComments.owner} • Close:{" "}
                    {new Date(selectedDealForComments.closeDate).toLocaleDateString()}
                  </p>
                </div>

                {/* Activity Feed */}
                <div className="space-y-3">
                  <h5 className="font-medium text-sm flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Recent Activity
                  </h5>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedDealForComments.activities.map((activity) => (
                      <div key={activity.id} className="flex items-center space-x-2 text-sm p-2 rounded bg-white/5">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">{activity.user}</span>
                        <span className="text-gray-600 dark:text-gray-400">{activity.action}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-3">
                  <h5 className="font-medium text-sm">Comments</h5>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedDealForComments.comments.map((comment) => (
                      <div key={comment.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{comment.author}</span>
                          <span className="text-xs text-gray-500">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                        {comment.mentions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {comment.mentions.map((mention, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                @{mention}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Comment */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        placeholder="Add a comment... Use @name to mention team members"
                        value={newComment}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        className="backdrop-blur-sm bg-white/10 border-white/20 min-h-[80px]"
                      />

                      {/* Mention Suggestions */}
                      {mentionSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-lg z-50">
                          {mentionSuggestions.map((member) => (
                            <button
                              key={member}
                              onClick={() => insertMention(member)}
                              className="w-full text-left px-3 py-2 hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg flex items-center space-x-2"
                            >
                              <AtSign className="w-4 h-4" />
                              <span>{member}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">Tip: Use @name to mention team members</p>
                      <Button
                        size="sm"
                        onClick={() => handleAddComment(selectedDealForComments.id)}
                        disabled={!newComment.trim()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageTransition>
    </DashboardLayout>
  )
}
