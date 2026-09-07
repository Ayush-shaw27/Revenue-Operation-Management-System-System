"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "custom"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  customColors: {
    primary: string
    secondary: string
    accent: string
  }
  setCustomColors: (colors: { primary: string; secondary: string; accent: string }) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [customColors, setCustomColors] = useState({
    primary: "#3b82f6",
    secondary: "#8b5cf6",
    accent: "#06b6d4",
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark", "custom")

    if (theme === "dark") {
      root.classList.add("dark")
      document.documentElement.setAttribute("data-theme", "dark")
    } else if (theme === "custom") {
      root.classList.add("custom")
      document.documentElement.setAttribute("data-theme", "custom")
      root.style.setProperty("--custom-primary", customColors.primary)
      root.style.setProperty("--custom-secondary", customColors.secondary)
      root.style.setProperty("--custom-accent", customColors.accent)
    } else {
      root.classList.add("light")
      document.documentElement.setAttribute("data-theme", "light")
    }
  }, [theme, customColors])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>{children}</ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
