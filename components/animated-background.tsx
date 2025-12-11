"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"

interface AnimatedBackgroundProps {
  variant?: "landing" | "login" | "dashboard" | "admin"
}

export function AnimatedBackground({ variant = "landing" }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
    }> = []

    // Create particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    function animate() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${particle.opacity})`
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const getGradientClass = () => {
    switch (variant) {
      case "landing":
        return "from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/50 dark:to-indigo-900/50"
      case "login":
        return "from-purple-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-purple-900/50 dark:to-pink-900/50"
      case "dashboard":
        return "from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800/50 dark:to-blue-900/50"
      case "admin":
        return "from-gray-900 via-red-900 to-orange-900 dark:from-black dark:via-gray-900 dark:to-red-900/50"
      default:
        return "from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/50 dark:to-indigo-900/50"
    }
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${getGradientClass()}`}
        animate={{
          background:
            variant === "admin"
              ? [
                  "linear-gradient(45deg, #1f2937, #7f1d1d, #ea580c)",
                  "linear-gradient(135deg, #7f1d1d, #ea580c, #1f2937)",
                  "linear-gradient(225deg, #ea580c, #1f2937, #7f1d1d)",
                  "linear-gradient(315deg, #1f2937, #7f1d1d, #ea580c)",
                ]
              : [
                  "linear-gradient(45deg, #f0f9ff, #e0e7ff, #f3e8ff)",
                  "linear-gradient(135deg, #e0e7ff, #f3e8ff, #fdf2f8)",
                  "linear-gradient(225deg, #f3e8ff, #fdf2f8, #f0f9ff)",
                  "linear-gradient(315deg, #fdf2f8, #f0f9ff, #e0e7ff)",
                ],
        }}
        transition={{
          duration: 10,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 opacity-30" />
    </div>
  )
}
