import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const body = await req.json()
    const { timetable_text, calendar_text, images } = body
    // images: Array<{ data: string (base64), mime_type: string }>

    if (!timetable_text && (!images || images.length === 0)) {
      throw new Error('Either timetable_text or at least one image is required')
    }

    const systemPrompt = `You are an AI academic assistant. The student has provided their weekly timetable and academic calendar (or holiday list) as text and/or images of their schedule documents.
Your task is to parse ALL provided information and extract:
1. The list of subjects.
2. The estimated number of hours per subject per week.
3. The total number of lectures for each subject in a typical month, accounting for any holidays mentioned.
4. An actionable strategy to maintain a 75% attendance criterion based on this schedule.

Return ONLY a JSON object that strictly adheres to the following schema:
{
  "subjects": [
    {
      "name": "Subject Name",
      "hours_per_week": number,
      "lectures_per_month": number
    }
  ],
  "total_monthly_lectures": number,
  "attendance_strategy": "A personalized paragraph of advice on how many classes they can afford to miss per subject while maintaining >75% attendance. Be specific with numbers.",
  "holidays_accounted": ["List of holidays identified from the calendar"]
}

Do not include any markdown formatting like \`\`\`json. Return raw JSON.`

    // Build the user content parts (multi-modal: text + images)
    const userParts: any[] = []

    // Add text content
    let textContent = ''
    if (timetable_text) {
      textContent += `Timetable:\n${timetable_text}\n\n`
    }
    textContent += `Calendar/Holidays:\n${calendar_text || 'None provided'}`
    userParts.push({ type: 'text', text: textContent })

    // Add image content (base64 encoded)
    if (images && images.length > 0) {
      for (const img of images) {
        userParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mime_type};base64,${img.data}`,
            detail: 'high'
          }
        })
      }
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userParts }
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

    const parsed = JSON.parse(rawContent)

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
