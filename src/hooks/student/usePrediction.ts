import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PredictionResult } from '../../types/app.types'

interface UsePredictionArgs {
  userId: string | undefined
  isAttendanceLoaded: boolean
  isGradesLoaded: boolean
}

export function usePrediction({ userId, isAttendanceLoaded, isGradesLoaded }: UsePredictionArgs) {
  return useQuery({
    queryKey: ['prediction', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      console.log('[Prediction] Attempting to compute prediction directly for:', userId)

      try {
        // Fetch requisite data manually
        const [attRes, gradesRes, profileRes] = await Promise.all([
           supabase.rpc('get_attendance_summary', { p_student_id: userId }),
           supabase.from('grades').select('*, classes(subjects(name))').eq('student_id', userId),
           supabase.from('profiles').select('semester, branch').eq('id', userId).single()
        ])

        const attendance = attRes.data
        const grades = gradesRes.data
        const profile = profileRes.data

        if (!attendance || attendance.length === 0) return undefined
        if (!grades || grades.length === 0) return undefined

        // Format prompt logic exactly like Edge function
        const attendanceContext = attendance?.map((a: any) =>
          `${a.subject_name}: ${a.percentage}% (${a.present_count}/${a.total_count} classes)`
        ).join('\n') || 'No attendance data'

        const gradesContext = grades?.map((g: any) =>
          `${g.classes?.subjects?.name}: Internal=${g.internal_marks}/50, External=${g.external_marks}/50, Total=${g.total_score}/100, Grade=${g.grade}`
        ).join('\n') || 'No grades data'

        const hasHighRiskAttendance = attendance?.some((a: any) => a.percentage < 75)
        const hasFailingGrade = grades?.some((g: any) => g.grade === 'F')

        const systemPrompt = `You are an academic performance analyst AI. Analyze the student data provided and return ONLY a JSON object — no markdown, no preamble.

The JSON must strictly match this schema:
{
  "predicted_grade": "A" | "B" | "C" | "D" | "F",
  "risk_level": "Low" | "Medium" | "High",
  "suggestions": string[],
  "confidence_note": string
}

GUARDRAILS (must follow absolutely):
- If ANY subject has attendance below 75%, risk_level MUST be "High"
- If predicted_grade is F or D, risk_level MUST be at least "Medium"
- Suggestions must be specific and actionable
- Predicted grade must be realistic
- If data is sparse, acknowledge uncertainty in confidence_note`

        const userPrompt = `Student Profile:
Semester: ${profile?.semester || 'Unknown'}
Branch: ${profile?.branch || 'Unknown'}

Attendance Summary:
${attendanceContext}

Grades Summary:
${gradesContext}

Additional flags:
- Attendance below threshold: ${hasHighRiskAttendance ? 'YES' : 'NO'}
- Has failing grade: ${hasFailingGrade ? 'YES' : 'NO'}

Analyze this data and return the prediction JSON.`

        const openAiKey = import.meta.env.VITE_OPENAI_API_KEY
        if (!openAiKey) throw new Error('Proxy mode failed: VITE_OPENAI_API_KEY is missing.')

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        })

        if (!openaiRes.ok) {
           const text = await openaiRes.text()
           throw new Error(`OpenAI fetch error: ${text}`)
        }

        const openaiData = await openaiRes.json()
        const rawContent = openaiData.choices?.[0]?.message?.content
        if (!rawContent) throw new Error('Empty response')

        const prediction = JSON.parse(rawContent)

        if (hasHighRiskAttendance && prediction.risk_level !== 'High') {
          prediction.risk_level = 'High'
          prediction.suggestions.unshift('URGENT: Attend ALL remaining classes — you are below the 75% minimum threshold.')
        }

        return prediction as PredictionResult
        return undefined
      } catch (error: any) {
        console.warn('[Prediction] Direct compilation error:', error.message)
        return undefined
      }
    },
    // Only run when base metrics exist
    enabled: !!userId && isAttendanceLoaded && isGradesLoaded,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}
