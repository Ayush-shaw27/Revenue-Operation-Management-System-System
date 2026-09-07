"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AnimatedBackground } from "@/components/animated-background"
import { BarChart3, Users, TrendingUp, Settings, LogOut, Menu, X, Home, UserCheck, Bell, BellDot, PieChart } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchUnreadAlertCount, fetchUnreadNotificationCount, markAllAlertsRead, markAllNotificationsRead, type Alert, type Notification, fetchAlerts, fetchNotifications, markAlertRead, markNotificationRead } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadAlertCount, setUnreadAlertCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [notifTab, setNotifTab] = useState<"alerts" | "notifications">("alerts")
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuth()

  const unreadTotal = unreadAlertCount + unreadNotifCount

  useEffect(() => {
    if (!isAuthenticated) return
    const load = async () => {
      try {
        const [ac, nc] = await Promise.all([fetchUnreadAlertCount(), fetchUnreadNotificationCount()])
        setUnreadAlertCount(ac)
        setUnreadNotifCount(nc)
      } catch {
        /* ignore */
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const loadNotificationsPanel = async () => {
    try {
      const [a, n] = await Promise.all([fetchAlerts(), fetchNotifications()])
      setAlerts(a)
      setNotifications(n)
      setUnreadAlertCount(a.filter((x) => !x.read).length)
      setUnreadNotifCount(n.filter((x) => !x.read).length)
    } catch {
      /* ignore */
    }
  }

  const toggleNotifPanel = async () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) await loadNotificationsPanel()
  }

  const handleAlertRead = async (id: string) => {
    await markAlertRead(id)
    await loadNotificationsPanel()
  }

  const handleNotifRead = async (id: string) => {
    await markNotificationRead(id)
    await loadNotificationsPanel()
  }

  const handleAlertsReadAll = async () => {
    await markAllAlertsRead()
    await loadNotificationsPanel()
  }

  const handleNotifsReadAll = async () => {
    await markAllNotificationsRead()
    await loadNotificationsPanel()
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Leads", href: "/leads", icon: UserCheck },
    { name: "Pipeline", href: "/pipeline", icon: BarChart3 },
    { name: "Forecast", href: "/forecast", icon: TrendingUp },
    ...(user?.role === "admin" ? [{ name: "Analytics", href: "/analytics", icon: PieChart }] : []),
    ...(user?.role === "admin" ? [{ name: "Admin", href: "/admin", icon: Settings }] : []),
  ]

  const getSeverityColor = (severity: string) => {
    if (severity === "high") return "bg-red-500"
    if (severity === "medium") return "bg-yellow-500"
    return "bg-blue-500"
  }

  const getNotifTypeColor = (type: string) => {
    if (type === "warning") return "bg-yellow-500"
    if (type === "success") return "bg-green-500"
    return "bg-blue-500"
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AnimatedBackground variant="dashboard" />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-64 backdrop-blur-xl glass-card/10 border-r border-white/20"
          >
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-16 items-center justify-between px-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold">RevOps Pro</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="lg:hidden">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href}>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                            : "text-gray-700 dark:text-gray-300 hover:glass-card/20"
                        }`}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </motion.div>
                    </Link>
                  )
                })}
              </nav>

              {/* User section */}
              <div className="p-4 border-t border-white/20">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.name || "Loading..."}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role?.replace("-", " ") || ""}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={logout}
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"}`}>
        {/* Header */}
        <header className="relative z-10 flex h-16 items-center justify-between glass-card/10 backdrop-blur-xl border-b border-white/20 px-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {navigation.find((item) => item.href === pathname)?.name || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={toggleNotifPanel} className="relative">
                {unreadTotal > 0 ? <BellDot className="w-5 h-5 text-yellow-500" /> : <Bell className="w-5 h-5" />}
                {unreadTotal > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] rounded-full">
                    {unreadTotal}
                  </Badge>
                )}
              </Button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-full mt-2 w-80 backdrop-blur-xl glass-card/10 border border-white/20 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden"
                  >
                    {/* Tabs */}
                    <div className="flex border-b border-white/20">
                      <button
                        onClick={() => setNotifTab("alerts")}
                        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                          notifTab === "alerts" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        Alerts ({unreadAlertCount})
                      </button>
                      <button
                        onClick={() => setNotifTab("notifications")}
                        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                          notifTab === "notifications" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        Notifications ({unreadNotifCount})
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                      {notifTab === "alerts" ? (
                        <>
                          {alerts.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-400">No alerts</div>
                          )}
                          {alerts.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => !a.read && handleAlertRead(a.id)}
                              className={`px-4 py-3 border-b border-white/10 text-sm cursor-pointer transition-colors ${
                                a.read ? "opacity-60" : "hover:glass-card/10"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getSeverityColor(a.severity)}`} />
                                <div>
                                  <p className="font-medium text-gray-200">{a.entity_name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{a.summary}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {alerts.length > 0 && (
                            <button
                              onClick={handleAlertsReadAll}
                              className="w-full py-2 text-xs text-blue-400 hover:glass-card/5 transition-colors"
                            >
                              Mark all as read
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {notifications.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-400">No notifications</div>
                          )}
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => !n.read && handleNotifRead(n.id)}
                              className={`px-4 py-3 border-b border-white/10 text-sm cursor-pointer transition-colors ${
                                n.read ? "opacity-60" : "hover:glass-card/10"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getNotifTypeColor(n.type)}`} />
                                <div>
                                  <p className="font-medium text-gray-200">{n.title}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {notifications.length > 0 && (
                            <button
                              onClick={handleNotifsReadAll}
                              className="w-full py-2 text-xs text-blue-400 hover:glass-card/5 transition-colors"
                            >
                              Mark all as read
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="relative z-10 p-6">{children}</main>
      </div>
    </div>
  )
}
