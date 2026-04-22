import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Unauthorized')

    // Verify mentor role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'mentor') throw new Error('Forbidden')

    const { question, conversation_history } = await req.json()
    // conversation_history: Array<{ role: 'user' | 'assistant', content: string }>

    // Fetch full cohort snapshot
    const { data: cohortData } = await supabase
      .rpc('get_mentor_cohort_summary', { p_mentor_id: user.id })

    // Fetch recent attendance events (last 14 days)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const { data: recentAttendance } = await supabase
      .from('attendance')
      .select(`
        student_id, status, date,
        profiles!attendance_student_id_fkey(full_name),
        classes(subjects(name))
      `)
      .gte('date', twoWeeksAgo.toISOString().split('T')[0])
      .in('student_id', cohortData?.map((s: any) => s.student_id) || [])
      .order('date', { ascending: false })

    // Build a condensed cohort context (keep it token-efficient)
    const cohortSummaryText = cohortData?.map((s: any) =>
      `${s.full_name} (Sem ${s.semester}, ${s.branch}): ` +
      `Avg Attendance=${s.avg_attendance}%, ` +
      `Avg Score=${s.avg_total_score}/100, ` +
      `Failing Subjects=${s.failing_subjects}, ` +
      `Risk=${s.risk_level}`
    ).join('\n') || 'No cohort data'

    // Recent attendance (condensed to last 30 events per student, max 5 students)
    const attendanceByStudent: Record<string, string[]> = {}
    recentAttendance?.forEach((a: any) => {
      const name = (a.profiles as any)?.full_name || a.student_id
      const subject = (a.classes as any)?.subjects?.name || 'Unknown'
      if (!attendanceByStudent[name]) attendanceByStudent[name] = []
      if (attendanceByStudent[name].length < 10) {
        attendanceByStudent[name].push(`${a.date}: ${subject} → ${a.status}`)
      }
    })

    const recentAttendanceText = Object.entries(attendanceByStudent)
      .slice(0, 8)
      .map(([name, events]) => `${name}:\n  ${events.join('\n  ')}`)
      .join('\n\n')

    const systemPrompt = `You are EduAssist, an intelligent academic analytics assistant for mentors at an educational institution.

You have access to real-time cohort data for mentor ${profile?.full_name}. Answer questions accurately, concisely, and helpfully.

COHORT DATA (${cohortData?.length || 0} students):
${cohortSummaryText}

RECENT ATTENDANCE LOG (last 14 days):
${recentAttendanceText || 'No recent attendance recorded'}

INSTRUCTIONS:
- Answer in 2-4 sentences max unless a list/table is specifically needed
- When listing students, always include their name and the specific metric
- If asked for action recommendations, be concrete and specific
- If the data doesn't support a confident answer, say so clearly
- For trend questions, work from the data provided
- Format lists with bullet points for readability
- Always end your response with ONE relevant follow-up question the mentor might want to ask (prefix it with "💡 You might also want to ask: ")
- Never fabricate data not present in the context`

    // Build messages array with conversation history (last 6 turns for context window efficiency)
    const recentHistory = (conversation_history || []).slice(-6)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: question }
    ]

    // Use streaming for a real-time typing effect
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        temperature: 0.3,
        stream: true,
        messages
      })
    })

    // Stream the response directly back to client
    return new Response(openaiRes.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
