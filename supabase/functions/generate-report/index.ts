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

    // Verify token & user
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Unauthorized')

    // Parse payload
    const { student_id, report_type } = await req.json()
    if (!student_id || !report_type) {
      throw new Error('Missing student_id or report_type')
    }

    // Verify mentor role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'mentor') throw new Error('Forbidden')

    // Fetch Student Profile
    const { data: student } = await supabase
      .from('profiles')
      .select('full_name, branch, semester, mentor_id')
      .eq('id', student_id)
      .single()

    if (!student) throw new Error('Student not found')
    // We implicitly trust that RLS or logic ensures this mentor is allowed, but let's be strict:
    if (student.mentor_id !== user.id) throw new Error('Not assigned to this student')

    // Fetch Attendance Summary using the RPC
    const { data: attendanceData } = await supabase
      .rpc('get_attendance_summary', { p_student_id: student_id })

    // Fetch Grades
    const { data: gradesData } = await supabase
       .from('grades')
       .select('*, classes(subjects(name))')
       .eq('student_id', student_id)

    // Fetch Interventions
    const { data: interventionsData } = await supabase
       .from('interventions')
       .select('*')
       .eq('student_id', student_id)
       .order('created_at', { ascending: false })

    // Data structuring for Context
    const attendanceText = attendanceData?.map((a: any) => 
      `${a.subject_name}: ${a.percentage}% (${a.present_count}/${a.total_count})`
    ).join('\n') || 'No attendance specific data'

    const gradesText = gradesData?.map((g: any) => 
      `${(g.classes as any)?.subjects?.name}: Int=${g.internal_marks}/50, Ext=${g.external_marks}/50, Total=${g.total_score}/100, Grade=${g.grade}`
    ).join('\n') || 'No grade specific data'

    const interventionsText = interventionsData?.map((i: any) => 
      `${new Date(i.created_at).toLocaleDateString()} - [${i.intervention_type}] ${i.notes}`
    ).join('\n') || 'No previous interventions recorded'

    // System Prompt configurations matching 'report_type' expectations
    let toneDescription = ''
    let sectionFields = ''

    if (report_type === 'summary') {
      toneDescription = 'professional, concise, direct mentor-facing tone'
      sectionFields = '["Academic Standing", "Attendance", "Recommendations"]'
    } else if (report_type === 'detailed') {
      toneDescription = 'highly structured, deeply analytical, formal admin-facing tone'
      sectionFields = '["Academic Performance", "Subject-by-Subject Analysis", "Attendance Patterns", "Risk Assessment", "Intervention History", "Recommendations"]'
    } else if (report_type === 'parent') {
      toneDescription = 'warm, encouraging, empathetic, clear, non-technical parent/guardian-facing tone'
      sectionFields = '["How is your child doing?", "Attendance", "What can help at home?", "Next steps"]'
    } else {
      throw new Error('Invalid report type')
    }

    const systemPrompt = `You are an expert Academic Advisor AI. Generate a formal academic progress report based STRICTLY on the data provided below. Do not fabricate data.
Use the student's actual name throughout the report natively, and explicitly reference specific module scores and specific percentages wherever feasible.

Tone constraint: ${toneDescription}
Required Section Headings precisely exactly as follows: ${sectionFields}

Return ONLY a valid JSON object matching the following structure entirely:

{
  "report_title": string,
  "generated_date": string,
  "student_name": string,
  "academic_period": string,
  "overall_status": "Satisfactory" | "Needs Improvement" | "At Risk" | "Excellent",
  "executive_summary": string,
  "sections": [
    {
      "title": string,
      "content": string,
      "data_points": [string]
    }
  ],
  "recommendations": [string],
  "closing_statement": string,
  "mentor_name": string
}

INSTRUCTIONS:
- Keep paragraph content precisely 3-5 sentences max in length per section.
- "data_points" array inside sections should highlight 2-3 specific quantitative metrics as standalone bullet notes derived directly from the text, otherwise leave empty array.
- "academic_period" should be generated dynamically e.g. "Semester {X} Progress Report".
- "recommendations" must be uniquely 3-5 hyper-actionable concrete items.
- Ensure the JSON is perfectly valid format with correct delimiters. Do not output markdown code blocks wrapping the json.`

    const userPrompt = `
Academic Data Context:

*** STUDENT INFO ***
Name: ${student.full_name}
Branch: ${student.branch}
Semester: ${student.semester}
Mentor: ${profile.full_name}

*** GRADES ***
${gradesText}

*** ATTENDANCE ***
${attendanceText}

*** LOGGED MENTOR INTERVENTIONS ***
${interventionsText}
`

    // Fetch AI Completion via GPT-4o
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Explicit guideline: use FULL gpt-4o for high quality report writing
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
           { role: 'system', content: systemPrompt },
           { role: 'user', content: userPrompt }
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
       throw new Error('No content generated by AI')
    }

    const reportJsonParams = JSON.parse(rawContent)

    // Compute data robustness logic dynamically
    let completeness = "full"
    if (!gradesText.includes('Int=') && !attendanceText.includes('%')) completeness = "minimal"
    else if (!gradesText.includes('Int=') || !attendanceText.includes('%')) completeness = "partial"

    const payload = {
       report: reportJsonParams,
       generated_at: new Date().toISOString(),
       data_completeness: completeness
    }

    // Persist directly to `reports` boundary seamlessly via the invoked mentor user scope to satisfy row levels
    // Use the backend Service Role essentially or just pass it in? We have Service Role! 
    // Wait, the policy says public.user_role() = 'mentor', which demands an authenticated Session user. 
    // Wait! Since we authenticated earlier via Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! wait look at line 14:
    // `const supabase = createClient(URL, SERVICE_KEY)`
    // This bypassed RLS entirely. But wait! The user prompt says "enable RLS mentors can insert".
    // We should insert using the authenticated token to naturally enforce RLS correctly:
    
    const authedSupabase = createClient(
       Deno.env.get('SUPABASE_URL')!,
       Deno.env.get('SUPABASE_ANON_KEY')!,
       { global: { headers: { Authorization: authHeader } } }
    )

    const { error: insertError } = await authedSupabase
       .from('reports')
       .insert({
          student_id: student_id,
          mentor_id: user.id,
          report_type: report_type,
          content: payload
       })

    if (insertError) {
      console.warn("Report was generated but could not be logged to DB:", insertError.message)
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
