import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Trash2, ArrowUp, Zap } from 'lucide-react'
import { useCohortChat } from '../../hooks/mentor/useCohortChat'
import { cn } from '../../lib/utils'

interface CohortChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function CohortChatPanel({ isOpen, onClose }: CohortChatPanelProps) {
  const { messages, isLoading, sendMessage, clearChat, suggestedPrompts } = useCohortChat()
  const [input, setInput] = useState('')
  const [randomPrompts, setRandomPrompts] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Select 4 random prompts on mount
  useEffect(() => {
    const shuffled = [...suggestedPrompts].sort(() => 0.5 - Math.random())
    setRandomPrompts(shuffled.slice(0, 4))
  }, [suggestedPrompts])

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Parses assistant messages to strip the "💡 You might also want to ask:" string
  // and separate it out to a clickable tag
  const parseMessage = (content: string) => {
    const lines = content.split('\n')
    const suggestionPrefix = '💡 You might also want to ask:'
    const suggestionIndex = lines.findIndex(l => l.includes(suggestionPrefix))
    
    if (suggestionIndex !== -1) {
      const mainText = lines.slice(0, suggestionIndex).join('\n').trim()
      const suggestionLines = lines.slice(suggestionIndex).join('\n')
      const suggestionQuery = suggestionLines.replace(suggestionPrefix, '').trim()
      return { mainText, suggestionQuery }
    }

    return { mainText: content, suggestionQuery: null }
  }

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full lg:w-[420px] bg-slate-900 border-l border-slate-700/50 shadow-2xl z-50 flex flex-col will-change-transform"
          >
            {/* Edge subtle gradient glow */}
            <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-brand-500/50 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0 bg-slate-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <div className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping opacity-50" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>EduAssist</h2>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Cohort Intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={clearChat}
                  disabled={messages.length === 0 || isLoading}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed group"
                  title="Clear conversation"
                >
                  <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center pt-8">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center mb-4 border border-brand-500/20">
                       <Zap className="text-brand-400" size={24} />
                    </div>
                    <p className="text-sm text-slate-400 mb-8 font-medium">What would you like to know?</p>
                  </motion.div>
                  
                  <div className="grid grid-cols-1 gap-3 w-full">
                    {randomPrompts.map((prompt, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => sendMessage(prompt)}
                        className="text-left py-3 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-brand-500/10 hover:border-brand-500/30 transition-all text-sm text-slate-300 hover:text-brand-300"
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-6">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    const { mainText, suggestionQuery } = parseMessage(msg.content)

                    return (
                      <motion.div 
                        key={msg.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex flex-col max-w-[88%]", isUser ? "self-end items-end" : "self-start items-start")}
                      >
                        <div 
                          className={cn(
                            "px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                            isUser 
                              ? "bg-brand-600 text-white rounded-tr-sm" 
                              : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50"
                          )}
                        >
                          <div className={cn("whitespace-pre-wrap", !isUser && "text-slate-300 font-light")}>
                            {mainText}
                            {msg.isStreaming && (
                              <span className="inline-block w-1.5 h-4 ml-1 bg-brand-400 align-middle animate-[pulse_0.75s_infinite]" />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center mt-1.5 px-1">
                          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Special Suggestion Render */}
                        {!isUser && suggestionQuery && !msg.isStreaming && (
                          <motion.button
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => sendMessage(suggestionQuery)}
                            className="mt-3 bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded-xl px-4 py-2 text-sm text-left hover:bg-brand-500/20 hover:border-brand-500/40 transition-colors shadow-sm"
                          >
                            <span className="font-semibold text-brand-400 mr-2">💡</span>
                            {suggestionQuery.replace(/^"|"(.*?)$/g, '$1')}
                          </motion.button>
                        )}
                      </motion.div>
                    )
                  })}
                  <div ref={messagesEndRef} className="h-2" />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-white/10 shrink-0">
               <div className="relative flex items-end gap-2 bg-slate-800 rounded-2xl border border-slate-700 p-1.5 focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all shadow-inner">
                  
                  {isLoading && input === '' && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>
                  )}

                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder="Ask about your cohort..."
                    className="w-full bg-transparent text-white placeholder:text-slate-500 text-[15px] resize-none py-2.5 px-3 max-h-32 min-h-[44px] focus:outline-none disabled:opacity-50"
                    rows={1}
                    maxLength={500}
                    style={{ fieldSizing: 'content' } as React.CSSProperties} // Modern auto-resize CSS
                  />
                  
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl shrink-0 transition-colors mb-0.5 mr-0.5"
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
               </div>
               
               {/* Character limit warning */}
               <div className="h-4 flex justify-end px-2 mt-1">
                 {input.length > 400 && (
                   <span className={cn("text-[10px] font-medium", input.length >= 500 ? "text-red-400" : "text-amber-400")}>
                     {input.length} / 500
                   </span>
                 )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
