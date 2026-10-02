'use client';

/** BarChart — Chart.js bar chart used for funnel / stage distributions. */
import { motion } from 'framer-motion';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { scaleIn } from '@/lib/motion';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  horizontal?: boolean;
  prefix?: string;
}

export default function BarChart({
  data,
  height = 220,
  horizontal = false,
  prefix = '',
}: BarChartProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="show"
      style={{ height }}
      className="relative w-full"
    >
      <Bar
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: data.map((d) => d.color || '#8b5cf6'),
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        }}
        options={{
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700, easing: 'easeOutQuart' },
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
              ticks: { color: 'rgba(140,150,170,0.7)', font: { size: 11 }, maxRotation: 0 },
              border: { display: false },
            },
            y: {
              grid: { color: 'rgba(140,150,170,0.08)' },
              ticks: { color: 'rgba(140,150,170,0.7)', font: { size: 11 } },
              border: { display: false },
            },
          },
        }}
      />
    </motion.div>
  );
}