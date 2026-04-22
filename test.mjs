import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kspyfssgcduoopiairsc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcHlmc3NnY2R1b29waWFpcnNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTQ2MDQsImV4cCI6MjA5MjM3MDYwNH0.QK4RxDxDffWrokpp79VERCZJw55ab75Ly83oeIyAR5w'
)

async function check() {
  const { data: users } = await supabase.from('profiles').select('*')
  console.log('Profiles:', users?.length)
  
  const { data: attendance } = await supabase.from('attendance').select('*')
  console.log('Attendance:', attendance?.length)
  
  const { data: grades } = await supabase.from('grades').select('*')
  console.log('Grades:', grades?.length)
}
check()
