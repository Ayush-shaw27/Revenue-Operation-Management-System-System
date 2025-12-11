"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Palette, Moon, Sun, Settings } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function ThemeToggle() {
  const { theme, setTheme, customColors, setCustomColors } = useTheme()
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)
  const [tempColors, setTempColors] = useState(customColors)

  const handleCustomSave = () => {
    setCustomColors(tempColors)
    setTheme("custom")
    setIsCustomDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {theme === "light" && <Sun className="h-4 w-4" />}
            {theme === "dark" && <Moon className="h-4 w-4" />}
            {theme === "custom" && <Palette className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="mr-2 h-4 w-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsCustomDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Custom
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Theme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="primary">Primary Color</Label>
              <Input
                id="primary"
                type="color"
                value={tempColors.primary}
                onChange={(e) => setTempColors({ ...tempColors, primary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="secondary">Secondary Color</Label>
              <Input
                id="secondary"
                type="color"
                value={tempColors.secondary}
                onChange={(e) => setTempColors({ ...tempColors, secondary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="accent">Accent Color</Label>
              <Input
                id="accent"
                type="color"
                value={tempColors.accent}
                onChange={(e) => setTempColors({ ...tempColors, accent: e.target.value })}
              />
            </div>
            <Button onClick={handleCustomSave} className="w-full">
              Apply Custom Theme
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
