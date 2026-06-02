import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth } from '../firebase/config'
import { functions } from '../firebase/functions'
import { useAuth } from '../context/AuthContext'

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Osei, your EPA assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (authLoading) return;
    if (!user) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please sign in to chat with Osei.' },
      ])
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const currentUser = auth.currentUser
      const token = currentUser ? await currentUser.getIdToken(true) : null
      console.log('ChatPage sending chatbot request', {
        user: user?.uid ?? null,
        currentUserUid: currentUser?.uid ?? null,
        tokenPresent: !!token,
        tokenSnippet: token ? `${token.slice(0, 10)}...` : null,
      })

      const chatbot = httpsCallable(functions, 'chatbot');
      const result = await chatbot({ messages: [...messages, userMessage] });
      const botReply = { role: 'assistant', content: result.data.reply };
      setMessages(prev => [...prev, botReply]);
    } catch (error) {
      console.error('Chat error:', error);
      console.error('Chat error details:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      });
      const message = error?.message ? `Sorry, Osei could not respond: ${error.message}` : 'Sorry, I encountered an error. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="chat-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Chat with Osei</h1>
        <div className="messages" style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              <strong>{msg.role === 'user' ? 'You' : 'Osei'}:</strong> {msg.content}
            </div>
          ))}
          {loading && <div style={{ textAlign: 'left' }}>Osei is typing...</div>}
        </div>
        <div className="input-area" style={{ display: 'flex' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={authLoading ? 'Checking sign-in status…' : user ? 'Type your message...' : 'Sign in to chat with Osei'}
            style={{ flex: 1, padding: '10px' }}
            disabled={loading || authLoading || !user}
          />
          <button onClick={sendMessage} disabled={authLoading || !user || loading || !input.trim()} style={{ padding: '10px' }}>Send</button>
        </div>
      </div>
  );
}