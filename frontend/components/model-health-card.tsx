"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useModelRegistry } from "@/hooks/use-api"
import { retrainModel } from "@/lib/api-client"
import { Brain, RefreshCw, Cpu, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export function ModelHealthCard() {
  const { data, isLoading, error, refetch } = useModelRegistry()
  const [retraining, setRetraining] = useState<string | null>(null)

  const handleRetrain = async (name: string) => {
    setRetraining(name)
    try {
      await retrainModel(name)
      toast.success(`Model "${name}" retrained successfully`)
      await refetch()
    } catch (err: any) {
      toast.error(`Retrain failed: ${err.message}`)
    } finally {
      setRetraining(null)
    }
  }

  if (isLoading) {
    return (
      <Card className="backdrop-blur-sm bg-white/10 border-white/20">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="backdrop-blur-sm bg-white/10 border-white/20">
        <CardContent className="p-6">
          <p className="text-red-500 text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const models = data ? Object.values(data) : []

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "classifier":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-[10px]">Classifier</Badge>
      case "regressor":
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-[10px]">Regressor</Badge>
      case "detector":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-[10px]">Detector</Badge>
      case "recommender":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-[10px]">Recommender</Badge>
      default:
        return <Badge className="text-[10px]">{kind}</Badge>
    }
  }

  return (
    <Card className="backdrop-blur-sm bg-white/10 border-white/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-blue-500" />
          <CardTitle className="text-lg">Model Health</CardTitle>
          <Badge variant="outline" className="text-xs">{models.length} models</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={refetch} className="h-8 w-8 p-0">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {models.map((m, index) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-3">
                <Brain className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-200">{m.name}</p>
                    {getKindBadge(m.kind)}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    v{m.version} · {m.trained_at.slice(0, 10)}
                    {m.accuracy > 0 && ` · ${m.accuracy}% accuracy`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={retraining === m.name}
                onClick={() => handleRetrain(m.name)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {retraining === m.name ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                {retraining === m.name ? "..." : "Retrain"}
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
