import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify token & user securely ensuring only mentors attempt mass mailing triggers
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'mentor') throw new Error('Forbidden: Only Mentors can mass compose messages.')

    // Parse payload
    const { student_ids, message_goal, channel, tone } = await req.json()
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      throw new Error('Missing or empty student_ids array')
    }
    if (!message_goal || !channel || !tone) {
      throw new Error('Missing parameter targets for composition')
    }

    // 1 & 2. Concurrently fetch rich explicit nested context blocks for each student targeted.
    const contextBlocks = await Promise.all(student_ids.map(async (student_id) => {
       const { data: student } = await supabase.from('profiles').select('full_name, branch, semester').eq('id', student_id).single()
       const { data: attendanceData } = await supabase.rpc('get_attendance_summary', { p_student_id: student_id })
       const { data: gradesData } = await supabase.from('grades').select('*, classes(subjects(name))').eq('student_id', student_id)
       const { data: interventions } = await supabase.from('interventions').select('*').eq('student_id', student_id).order('created_at', { ascending: false }).limit(1)

       const attendanceText = attendanceData?.map((a: any) => 
         `${a.subject_name}: ${a.percentage}% (${a.present_count}/${a.total_count})`
       ).join(' | ') || 'No attendance records'

       const gradesText = gradesData?.map((g: any) => 
         `${(g.classes as any)?.subjects?.name}: ${g.total_score}/100 (${g.grade})`
       ).join(' | ') || 'No grade specific data'

       const recentIntervention = interventions && interventions.length > 0 
           ? `[${interventions[0].type} on ${new Date(interventions[0].created_at).toLocaleDateString()}]: ${interventions[0].notes}`
           : 'None logged'

       return `
====== STUDENT ID: ${student_id} ======
Name: ${student?.full_name}
Academic Info: ${student?.branch}, Sem ${student?.semester}
Grades Overview: ${gradesText}
Attendance Overview: ${attendanceText}
Most Recenet Intervention Found: ${recentIntervention}
`
    }))

    const globalContext = contextBlocks.join('\n')

    // 3. Prompt Engineering
    let lengthConstraint = ""
    if (channel === 'email') lengthConstraint = "Strictly 200 to 350 words per message."
    else if (channel === 'sms') lengthConstraint = "Strictly exactly less than 160 characters (Short, punchy)."
    else if (channel === 'letter') lengthConstraint = "Strictly 400 to 600 words formal letter length."

    const systemPrompt = `You are an expert Academic Advisor AI Assistant writing targeted, personalized communications natively on behalf of a Mentor explicitly tailored for a cohort context. 
    
Constraint Checklist: 
- Channel / Format: ${channel.toUpperCase()} (${lengthConstraint})
- Message Goal / Context: ${message_goal.toUpperCase()}
- Tone Constraint: ${tone.toUpperCase()}

CRITICAL RULES:
- If message goal is 'parent_notification', explicitly address the parent/guardian rather than the student ("Dear Parent of [Student]"). 
- Every message must explicitly and natively reference specific, concrete numbers found exactly in the provided academic context blocks (e.g., specific % or exact subject scores). Do NOT hallucinate data.
- NEVER use generic filler introduction texts like "I hope this message finds you well" whatsoever. Start directly and impactfully.
- Keep the exact tone constraints flawlessly.

You MUST respond ONLY with a valid JSON array matching EXACTLY the schema below:
[
  { 
    "student_id": "the exact UUID matched from the block", 
    "subject_line": "Catchy short subject or SMS introductory line", 
    "body": "The fully composed message content properly spaced", 
    "personalization_notes": "1 specific sentence detailing EXACTLY which dataset metric informed the tone/content here." 
  }
]
`

    const userPrompt = `Generate the batch message requests for the following targeted students natively using their explicit parameters provided:
    
ALL TARGETED STUDENT CONTEXTS:
${globalContext}
`

    // Call GPT-4o-mini ONCE explicitly batching contexts natively
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' }, // Array wrapper json schema enforcement
        messages: [
           { role: 'system', content: systemPrompt },
           { role: 'user', content: userPrompt + '\n\nEnclose your output array in a JSON object using the key "messages", like: { "messages": [ ... ] }' }
        ]
      })
    })

    if (!openaiRes.ok) {
       const tx = await openaiRes.text()
       throw new Error(`OpenAI Request Failed: ${tx}`)
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content
    
    if (!rawContent) {
       throw new Error('No content returned by AI engine')
    }

    const parsedJson = JSON.parse(rawContent)
    const arrayOutput = parsedJson.messages || parsedJson // Fallback parsing securely

    return new Response(JSON.stringify(arrayOutput), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
