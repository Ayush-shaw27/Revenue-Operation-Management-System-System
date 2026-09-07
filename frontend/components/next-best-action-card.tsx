"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Phone, Mail, Percent, ArrowUp, BookOpen, Calendar } from "lucide-react"
import type { ActionRecommendation } from "@/lib/api-client"

const channelIcons: Record<string, React.ReactNode> = {
  phone: <Phone className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  internal: <ArrowUp className="w-3 h-3" />,
}

const actionIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-400" />,
  discount: <Percent className="w-3.5 h-3.5 text-emerald-400" />,
  escalate: <ArrowUp className="w-3.5 h-3.5 text-red-400" />,
  send_case_study: <BookOpen className="w-3.5 h-3.5 text-purple-400" />,
  schedule_review: <Calendar className="w-3.5 h-3.5 text-yellow-400" />,
}

interface NextBestActionCardProps {
  recommendations: ActionRecommendation[]
}

export function NextBestActionCard({ recommendations }: NextBestActionCardProps) {
  const top = recommendations.slice(0, 3)

  if (top.length === 0) return null

  return (
    <Card className="mt-3 bg-white/5 border-white/10">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center space-x-1.5 text-xs font-medium text-purple-400">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Next Best Actions</span>
        </div>
        {top.map((rec, i) => (
          <motion.div
            key={rec.action_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-2"
          >
            <div className="mt-0.5">{actionIcons[rec.action_id]}</div>
            <div className="flex-1">
              <p className="text-xs text-gray-200">{rec.action}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                    style={{ width: `${Math.round(rec.priority * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500">{Math.round(rec.priority * 100)}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}
