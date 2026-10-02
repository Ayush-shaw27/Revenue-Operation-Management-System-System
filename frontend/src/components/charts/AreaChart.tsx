'use client';

/** AreaChart — Chart.js line/area chart with animated transitions on refresh. */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { scaleIn } from '@/lib/motion';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface SeriesPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  fill?: boolean;
  animate?: boolean;
  prefix?: string;
}

export default function AreaChart({
  data,
  height = 220,
  color = '#06b6d4',
  fill = true,
  animate = true,
  prefix = '',
}: AreaChartProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="show"
      style={{ height }}
      className="relative w-full"
    >
      <Line
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              borderColor: color,
              backgroundColor: fill ? `${color}22` : 'transparent',
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: color,
              tension: 0.4,
              fill,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: animate ? { duration: 800, easing: 'easeOutQuart' } : false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(10,13,25,0.9)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                label: (ctx) => (prefix ? `${prefix}${(ctx.parsed.y ?? 0).toLocaleString()}` : `${(ctx.parsed.y ?? 0).toLocaleString()}`),
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: 'rgba(140,150,170,0.7)', maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } },
              border: { display: false },
            },
            y: {
              grid: { color: 'rgba(140,150,170,0.08)' },
              ticks: { color: 'rgba(140,150,170,0.7)', font: { size: 11 }, maxTicksLimit: 5 },
              border: { display: false },
            },
          },
        }}
      />
    </motion.div>
  );
}