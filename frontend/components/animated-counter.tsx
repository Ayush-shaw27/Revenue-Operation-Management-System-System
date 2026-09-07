"use client"

import { useEffect, useRef, useState } from "react"
import { animate, useReducedMotion } from "framer-motion"

interface AnimatedCounterProps {
  value: number
  duration?: number
  format?: (n: number) => string
}

export function AnimatedCounter({ value, duration = 1, format }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0)
  const prefersReduced = useReducedMotion()
  const prevRef = useRef(0)

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value)
      return
    }
    const controls = animate(prevRef.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        prevRef.current = v
        setDisplay(v)
      },
    })
    return () => controls.stop()
  }, [value, duration, prefersReduced])

  if (format) return <>{format(display)}</>
  return <>{Math.round(display).toLocaleString()}</>
}
