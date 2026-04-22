import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Verify JWT and get user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const studentId = body.student_id || user.id

    // 2. Fetch attendance summary
    const { data: attendance, error: attErr } =
      await supabase.rpc('get_attendance_summary', { p_student_id: studentId })
    if (attErr) throw attErr

    // 3. Fetch grades
    const { data: grades, error: gradeErr } = await supabase
      .from('grades')
      .select('*, classes(subjects(name))')
      .eq('student_id', studentId)
    if (gradeErr) throw gradeErr

    // 4. Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('semester, branch')
      .eq('id', studentId)
      .single()

    // 5. Build context string
    const attendanceContext = attendance?.map((a: any) =>
      `${a.subject_name}: ${a.percentage}% (${a.present_count}/${a.total_count} classes)`
    ).join('\n') || 'No attendance data'

    const gradesContext = grades?.map((g: any) =>
      `${g.classes?.subjects?.name}: Internal=${g.internal_marks}/50, External=${g.external_marks}/50, Total=${g.total_score}/100, Grade=${g.grade}`
    ).join('\n') || 'No grades data'

    const hasHighRiskAttendance = attendance?.some((a: any) => a.percentage < 75)
    const hasFailingGrade = grades?.some((g: any) => g.grade === 'F')

    // 6. Construct the prompt
    const systemPrompt = `You are an academic performance analyst AI. Analyze the student data provided and return ONLY a JSON object — no markdown, no preamble.

The JSON must strictly match this schema:
{
  "predicted_grade": "A" | "B" | "C" | "D" | "F",
  "risk_level": "Low" | "Medium" | "High",
  "suggestions": string[], (2 to 4 concrete, actionable suggestions)
  "confidence_note": string (one sentence, e.g. "Based on 3 subjects with complete data")
}

GUARDRAILS (must follow absolutely):
- If ANY subject has attendance below 75%, risk_level MUST be "High"
- If predicted_grade is F or D, risk_level MUST be at least "Medium"
- Suggestions must be specific and actionable, not generic
- Predicted grade must be the realistic expected final grade based on current trajectory
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

    // 7. Call OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
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
      const errText = await openaiRes.text()
      throw new Error(`OpenAI error: ${errText}`)
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content
    if (!rawContent) throw new Error('Empty response from OpenAI')

    // 8. Parse and validate
    const prediction = JSON.parse(rawContent)

    const validGrades = ['A', 'B', 'C', 'D', 'F']
    const validRisks = ['Low', 'Medium', 'High']

    if (!validGrades.includes(prediction.predicted_grade)) throw new Error('Invalid predicted_grade')
    if (!validRisks.includes(prediction.risk_level)) throw new Error('Invalid risk_level')
    if (!Array.isArray(prediction.suggestions)) throw new Error('suggestions must be array')

    // 9. Enforce guardrail server-side
    if (hasHighRiskAttendance && prediction.risk_level !== 'High') {
      prediction.risk_level = 'High'
      prediction.suggestions.unshift('URGENT: Attend ALL remaining classes — you are below the 75% minimum threshold.')
    }

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
