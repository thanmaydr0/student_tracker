import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { CalendarOff, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Card from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import type { AttendanceSummary } from '../../types/app.types'

interface AttendanceChartProps {
  data: AttendanceSummary[] | undefined
  isLoading: boolean
}

// Pure function to determine bar color
function getBarColor(percentage: number): string {
  if (percentage > 75) return '#22c55e' // emerald-500
  if (percentage === 75) return '#f59e0b' // amber-400
  return '#ef4444' // red-500
}

// Helper to truncate long labels
function truncateLabel(str: string, maxLength: number = 10) {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

// Custom Recharts Tooltip
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as AttendanceSummary
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <p className="mb-2 font-semibold text-brand-900">{data.subject_name}</p>
        <div className="flex flex-col gap-1 text-sm text-brand-600">
          <p>
            <span className="font-medium text-brand-500">Attendance:</span>{' '}
            <span
              className="font-bold"
              style={{ color: getBarColor(data.percentage) }}
            >
              {data.percentage}%
            </span>
          </p>
          <p>
            <span className="font-medium text-brand-500">Classes:</span>{' '}
            {data.present} present / {data.total} total
          </p>
        </div>
      </div>
    )
  }
  return null
}

export default function AttendanceChart({ data, isLoading }: AttendanceChartProps) {
  const failingCount = useMemo(() => {
    if (!data) return 0
    return data.filter((item) => item.percentage < 75).length
  }, [data])

  const actionLink = (
    <Link
      to="/student/attendance"
      className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
    >
      View details
    </Link>
  )

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card title="Attendance Overview" action={actionLink}>
           <Skeleton className="h-[260px] w-full mt-4" />
        </Card>
      </motion.div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card title="Attendance Overview" action={actionLink}>
          <div className="flex h-[260px] flex-col items-center justify-center text-slate-400 mt-4">
            <CalendarOff size={48} className="mb-4 opacity-50" strokeWidth={1.5} />
            <p className="text-sm font-medium">No attendance data yet</p>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
      <Card title="Attendance Overview" action={actionLink}>
        {/* Warning Banner */}
        {failingCount > 0 && (
          <div className="mb-4 mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={18} className="shrink-0" />
            <p>
              <span className="font-semibold">{failingCount}</span> subject(s) below the 75% attendance threshold.
            </p>
          </div>
        )}

        {/* Chart Container */}
        <div className="mt-4 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barSize={36}
              barCategoryGap="30%"
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="subject_name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickFormatter={(value) => truncateLabel(value, 10)}
                dy={10}
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                dx={-10}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  )
}
