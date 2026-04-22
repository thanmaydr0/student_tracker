import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  role: 'student' | 'mentor'
  children: ReactNode
}

export default function AppShell({ role, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Use a title for TopBar. Might need dynamic logic later.
  const topBarTitle = "EduPredict" 

  return (
    <div className="flex min-h-screen bg-surface-50 font-sans text-slate-900">
      <Sidebar 
        role={role} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      <div className="flex flex-1 flex-col md:pl-[240px]">
        <TopBar 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title={topBarTitle}
        />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
