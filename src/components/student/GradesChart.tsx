import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BookX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Card from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import type { GradeSummary } from '../../types/app.types'

interface GradesChartProps {
  data: GradeSummary[] | undefined
  isLoading: boolean
}

// Helper to truncate long labels
function truncateLabel(str: string, maxLength: number = 10) {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as GradeSummary
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <p className="mb-2 font-semibold text-brand-900">{data.subject_name}</p>
        <div className="flex flex-col gap-1 text-sm text-brand-600">
           <p className="flex justify-between gap-4">
            <span className="font-medium text-brand-500">Internal:</span>
            <span className="font-bold text-indigo-500">{data.internal}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="font-medium text-brand-500">External:</span>
            <span className="font-bold text-brand-500">{data.external}</span>
          </p>
          <div className="my-1 border-t border-slate-100" />
          <p className="flex justify-between gap-4">
            <span className="font-medium text-brand-500">Total:</span>
            <span className="font-bold text-brand-900">{data.total}</span>
          </p>
          <p className="flex justify-between gap-4 mt-1">
             <span className="font-medium text-brand-500">Grade:</span>
             <span className="font-bold border border-slate-200 px-2 rounded bg-slate-50">{data.grade || 'N/A'}</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

export default function GradesChart({ data, isLoading }: GradesChartProps) {
  const isDataEmpty = !data || data.length === 0

  const actionLink = (
    <Link
      to="/student/grades"
      className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
    >
      View transcript
    </Link>
  )

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card title="Grades Overview" action={actionLink}>
           <Skeleton className="h-[260px] w-full mt-4" />
        </Card>
      </motion.div>
    )
  }

  if (isDataEmpty) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card title="Grades Overview" action={actionLink}>
          <div className="flex h-[260px] flex-col items-center justify-center text-slate-400 mt-4">
            <BookX size={48} className="mb-4 opacity-50" strokeWidth={1.5} />
            <p className="text-sm font-medium">No grades recorded yet</p>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <Card title="Grades Overview" action={actionLink}>
        {/* Chart Container */}
        <div className="mt-4 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barSize={24}
              barCategoryGap="10%"
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
                domain={[0, 'dataMax']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} iconType="circle" />
              <Bar dataKey="internal" name="Internal" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
              <Bar dataKey="external" name="External" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  )
}
