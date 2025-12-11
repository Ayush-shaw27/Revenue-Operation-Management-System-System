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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageTransition } from "@/components/page-transition"
import { AnimatedBackground } from "@/components/animated-background"
import { Plus, Edit, Trash2, Shield, Activity, Users, Settings } from "lucide-react"
import { FlaskAPIPlaceholder } from "@/components/flask-api-placeholder"

interface User {
  id: number
  name: string
  email: string
  role: "admin" | "manager" | "sales-executive"
  status: "active" | "inactive"
  lastLogin: string
  createdAt: string
}

interface AuditLog {
  id: number
  user: string
  action: string
  resource: string
  timestamp: string
  ip: string
}

const initialUsers: User[] = [
  {
    id: 1,
    name: "John Smith",
    email: "john@company.com",
    role: "admin",
    status: "active",
    lastLogin: "2024-01-19 14:30",
    createdAt: "2024-01-01",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah@company.com",
    role: "manager",
    status: "active",
    lastLogin: "2024-01-19 12:15",
    createdAt: "2024-01-05",
  },
  {
    id: 3,
    name: "Mike Chen",
    email: "mike@company.com",
    role: "sales-executive",
    status: "active",
    lastLogin: "2024-01-19 09:45",
    createdAt: "2024-01-10",
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily@company.com",
    role: "sales-executive",
    status: "inactive",
    lastLogin: "2024-01-15 16:20",
    createdAt: "2024-01-12",
  },
]

const auditLogs: AuditLog[] = [
  {
    id: 1,
    user: "John Smith",
    action: "User Created",
    resource: "User: Mike Chen",
    timestamp: "2024-01-19 14:30:15",
    ip: "192.168.1.100",
  },
  {
    id: 2,
    user: "Sarah Johnson",
    action: "Lead Updated",
    resource: "Lead: Acme Corp Deal",
    timestamp: "2024-01-19 12:15:30",
    ip: "192.168.1.101",
  },
  {
    id: 3,
    user: "Mike Chen",
    action: "Deal Moved",
    resource: "Deal: Enterprise License",
    timestamp: "2024-01-19 09:45:22",
    ip: "192.168.1.102",
  },
  {
    id: 4,
    user: "Emily Davis",
    action: "Report Generated",
    resource: "Monthly Sales Report",
    timestamp: "2024-01-18 16:20:45",
    ip: "192.168.1.103",
  },
]

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "sales-executive" as const,
    status: "active" as const,
  })

  const handleAddUser = () => {
    const user: User = {
      id: users.length + 1,
      ...newUser,
      lastLogin: "Never",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setUsers([...users, user])
    setNewUser({
      name: "",
      email: "",
      role: "sales-executive",
      status: "active",
    })
    setIsAddUserOpen(false)
  }

  const handleDeleteUser = (id: number) => {
    setUsers(users.filter((user) => user.id !== id))
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
      case "manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "sales-executive":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }

  return (
    <DashboardLayout>
      <AnimatedBackground variant="admin" />
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <p className="text-gray-300">Manage users and system settings</p>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-red-400" />
              <span className="text-red-400 font-medium">Admin Access</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                title: "Total Users",
                value: users.length.toString(),
                icon: Users,
                color: "from-blue-500 to-cyan-600",
              },
              {
                title: "Active Users",
                value: users.filter((u) => u.status === "active").length.toString(),
                icon: Activity,
                color: "from-green-500 to-emerald-600",
              },
              {
                title: "Admins",
                value: users.filter((u) => u.role === "admin").length.toString(),
                icon: Shield,
                color: "from-red-500 to-rose-600",
              },
              {
                title: "System Health",
                value: "99.9%",
                icon: Settings,
                color: "from-purple-500 to-pink-600",
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, rotateY: 5 }}
                style={{ perspective: "1000px" }}
              >
                <Card className="backdrop-blur-sm bg-white/10 border-white/20 hover:bg-white/20 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-300">{stat.title}</p>
                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                      </div>
                      <div
                        className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}
                      >
                        <stat.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* User Management */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">User Management</CardTitle>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="backdrop-blur-xl bg-white/10 border-white/20">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-white">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-white">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          className="backdrop-blur-sm bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role" className="text-white">
                          Role
                        </Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger className="backdrop-blur-sm bg-white/10 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="sales-executive">Sales Executive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddUser} className="w-full">
                        Add User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20">
                      <TableHead className="text-gray-300">Name</TableHead>
                      <TableHead className="text-gray-300">Email</TableHead>
                      <TableHead className="text-gray-300">Role</TableHead>
                      <TableHead className="text-gray-300">Status</TableHead>
                      <TableHead className="text-gray-300">Last Login</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {users.map((user, index) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-white/20 hover:bg-white/5"
                        >
                          <TableCell className="text-white font-medium">{user.name}</TableCell>
                          <TableCell className="text-gray-300">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">{user.lastLogin}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>

          {/* Flask API Integration */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <FlaskAPIPlaceholder />
          </motion.div>

          {/* Audit Logs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-white font-medium">{log.user}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-blue-400">{log.action}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-300">{log.resource}</span>
                        </div>
                        <div className="flex items-center space-x-3 mt-1 text-sm text-gray-400">
                          <span>{log.timestamp}</span>
                          <span>•</span>
                          <span>{log.ip}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  )
}
