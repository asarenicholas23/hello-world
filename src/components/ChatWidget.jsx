import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/functions'
import { auth } from '../firebase/config'
import { MessageSquare, X, Send } from 'lucide-react'

const initialMessages = [
  {
    role: 'assistant',
    content: 'Hello! I am Osei, your EPA assistant. I can help with facility lookup, permit guidance, and compliance questions.'
  }
]

export default function ChatWidget() {
  const { user, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    if (authLoading) return
    if (!user) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please sign in to chat with Osei.' },
      ])
      return
    }

    const userMessage = { role: 'user', content: input }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const currentUser = auth.currentUser
      const token = currentUser ? await currentUser.getIdToken(true) : null
      console.log('ChatWidget sending chatbot request', {
        user: user?.uid ?? null,
        currentUserUid: currentUser?.uid ?? null,
        tokenPresent: !!token,
        tokenSnippet: token ? `${token.slice(0, 10)}...` : null,
      })

      const chatbot = httpsCallable(functions, 'chatbot')
      const result = await chatbot({ messages: nextMessages })
      const botReply = { role: 'assistant', content: result.data.reply }
      setMessages((prev) => [...prev, botReply])
    } catch (error) {
      console.error('Chat widget error:', error)
      console.error('Chat widget error details:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      })
      const content = error?.message
        ? `Sorry, Osei could not respond: ${error.message}`
        : 'Sorry, I could not reach Osei right now. Please try again later.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <div>
              <div className="chat-widget-title">Osei</div>
              <div className="chat-widget-subtitle">EPA assistant</div>
            </div>
            <button className="chat-widget-close" onClick={() => setOpen(false)} title="Close chat">
              <X size={16} />
            </button>
          </div>

          <div className="chat-widget-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-widget-message chat-widget-message--${msg.role}`}
              >
                <span className="chat-widget-message-role">
                  {msg.role === 'user' ? 'You' : 'Osei'}
                </span>
                <p>{msg.content}</p>
              </div>
            ))}
            {loading && <div className="chat-widget-status">Osei is typing...</div>}
          </div>

          <div className="chat-widget-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={authLoading ? 'Checking sign-in status…' : user ? 'Ask Osei a question...' : 'Sign in to chat with Osei'}
              disabled={loading || authLoading || !user}
            />
            <button onClick={sendMessage} disabled={authLoading || !user || loading || !input.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-widget-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open chat with Osei"
      >
        <MessageSquare size={20} />
      </button>
    </div>
  )
}
