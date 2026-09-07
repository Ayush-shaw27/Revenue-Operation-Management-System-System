"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchLeads,
  fetchDeals,
  fetchChurnRisk,
  fetchAlerts,
  fetchNotifications,
  fetchAnomalies,
  fetchNextBestActions,
  fetchAccounts,
  fetchAnalyticsFunnel,
  fetchAnalyticsCohorts,
  fetchAdminStats,
  fetchAdminActivity,
  fetchModelRegistry,
  type Lead,
  type Deal,
  type ChurnPrediction,
  type Alert,
  type Notification,
  type AnomalyDetection,
  type NextBestAction,
  type Account,
  type FunnelItem,
  type CohortItem,
  type AdminStats,
  type AuditLog,
  type ModelRegistryEntry,
} from "@/lib/api-client"

interface UseApiResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (e: any) {
      setError(e.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, deps)

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, isLoading, error, refetch }
}

export function useLeads() {
  return useApi<Lead[]>(fetchLeads)
}

export function useDeals() {
  return useApi<Deal[]>(fetchDeals)
}

export function useChurnRisk() {
  return useApi<ChurnPrediction[]>(fetchChurnRisk)
}

export function useAlerts() {
  return useApi<Alert[]>(fetchAlerts)
}

export function useNotifications() {
  return useApi<Notification[]>(fetchNotifications)
}

export function useAnomalies() {
  return useApi<AnomalyDetection[]>(fetchAnomalies)
}

export function useNextBestActions() {
  return useApi<NextBestAction[]>(fetchNextBestActions)
}

export function useAccounts() {
  return useApi<Account[]>(fetchAccounts)
}

export function useAnalyticsFunnel(by: "source" | "stage") {
  return useApi<{ by: string; funnel: FunnelItem[] }>(() => fetchAnalyticsFunnel(by), [by])
}

export function useAnalyticsCohorts() {
  return useApi<CohortItem[]>(fetchAnalyticsCohorts)
}

export function useAdminStats() {
  return useApi<AdminStats>(fetchAdminStats)
}

export function useAdminActivity() {
  return useApi<AuditLog[]>(fetchAdminActivity)
}

export function useModelRegistry() {
  return useApi<Record<string, ModelRegistryEntry>>(fetchModelRegistry)
}
