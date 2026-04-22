import { useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface UseCohortChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (question: string) => Promise<void>
  clearChat: () => void
  suggestedPrompts: string[]
}

const SUGGESTED_PROMPTS = [
  "Which students are at high risk this semester?",
  "Who has attendance below 75% in any subject?",
  "Show me students with failing grades",
  "Which students have improved the most recently?",
  "Who hasn't attended class this week?",
  "Summarize the overall health of my cohort",
  "Which subjects have the lowest average scores?",
  "Who needs urgent intervention right now?"
]

export const useCohortChat = (): UseCohortChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const suggestedPrompts = SUGGESTED_PROMPTS


  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const assistantMsgId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      abortRef.current = new AbortController()

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cohort-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            question,
            conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
          }),
          signal: abortRef.current.signal
        }
      )

      if (!res.ok) throw new Error('Request failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            accumulated += delta
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m
            ))
          } catch {}
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, isStreaming: false } : m
      ))

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
            : m
        ))
      }
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setIsLoading(false)
  }, [])

  return { messages, isLoading, sendMessage, clearChat, suggestedPrompts }
}
