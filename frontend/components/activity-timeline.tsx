"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchActivities, createActivity, type Activity } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { Phone, Mail, StickyNote, ArrowRightLeft, Send, Loader2 } from "lucide-react"

interface ActivityTimelineProps {
  dealId?: string
  leadId?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-400" />,
  email: <Mail className="w-3.5 h-3.5 text-purple-400" />,
  note: <StickyNote className="w-3.5 h-3.5 text-green-400" />,
  stage_change: <ArrowRightLeft className="w-3.5 h-3.5 text-yellow-400" />,
}

const typeColors: Record<string, string> = {
  call: "bg-blue-500",
  email: "bg-purple-500",
  note: "bg-green-500",
  stage_change: "bg-yellow-500",
}

export function ActivityTimeline({ dealId, leadId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newType, setNewType] = useState("note")
  const [newContent, setNewContent] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const { user } = useAuth()

  const loadActivities = async () => {
    setIsLoading(true)
    try {
      setActivities(await fetchActivities(dealId, leadId))
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadActivities()
  }, [dealId, leadId])

  const handleAddActivity = async () => {
    if (!newContent.trim()) return
    setIsAdding(true)
    try {
      await createActivity({
        deal_id: dealId,
        lead_id: leadId,
        type: newType,
        content: newContent.trim(),
      })
      setNewContent("")
      await loadActivities()
    } catch {
      /* ignore */
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 border-white/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add activity form */}
        <div className="flex gap-2">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-24 backdrop-blur-sm bg-white/10 border-white/20 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Add a note..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddActivity()}
            className="flex-1 backdrop-blur-sm bg-white/10 border-white/20 text-xs h-8"
          />
          <Button
            size="sm"
            onClick={handleAddActivity}
            disabled={isAdding || !newContent.trim()}
            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
          >
            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-white/10" />
            <div className="space-y-3">
              <AnimatePresence>
                {activities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-3 relative"
                  >
                    {/* Dot */}
                    <div className={`w-[22px] h-[22px] rounded-full ${typeColors[activity.type] || typeColors.note} flex items-center justify-center flex-shrink-0 z-10`}>
                      {typeIcons[activity.type] || typeIcons.note}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.author} · {activity.type.replace("_", " ")}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{activity.content}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">{activity.created_at}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
