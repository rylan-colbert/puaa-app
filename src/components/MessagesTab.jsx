import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../api'

function defaultApproveDates() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const start = d.toISOString().slice(0, 16)
  const e = new Date(d)
  e.setHours(17, 0, 0, 0)
  return { start, end: e.toISOString().slice(0, 16) }
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function MessagesTab() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [thread, setThread] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [conversationMeta, setConversationMeta] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [approveReq, setApproveReq] = useState(null)
  const [processing, setProcessing] = useState(null)
  const messagesEndRef = useRef(null)
  const listEndRef = useRef(null)

  const isHunter = user?.role === 'hunter'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    loadConversations()
  }, [])

  // Poll every 20s so new hunter requests show up without manual refresh
  useEffect(() => {
    const interval = setInterval(loadConversations, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selected) {
      loadThread(selected)
    } else {
      setThread([])
      setOtherUser(null)
      setConversationMeta(null)
    }
  }, [selected])

  useEffect(() => {
    scrollToBottom()
  }, [thread])

  async function loadConversations() {
    setLoading(true)
    setError('')
    try {
      const list = await api.listConversations({ page: 1, page_size: 50 })
      setConversations(Array.isArray(list) ? list : [])
      if (!selected && list?.length > 0) {
        setSelected(list[0].id)
      }
    } catch (err) {
      setError(err.message || 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  async function loadThread(requestId) {
    setError('')
    try {
      const data = await api.getConversation(requestId)
      setThread(data.thread || [])
      setOtherUser(data.other_user || null)
      setConversationMeta(data.conversation || null)
    } catch (err) {
      setError(err.message || 'Failed to load messages')
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selected || sending) return
    setSending(true)
    setError('')
    try {
      await api.sendMessage(selected, { body: newMessage.trim() })
      setNewMessage('')
      await loadThread(selected)
      await loadConversations()
    } catch (err) {
      setError(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleApproveRequest(e) {
    e.preventDefault()
    if (!approveReq) return
    setError('')
    setProcessing(approveReq.requestId)
    try {
      let start = approveReq.start_time
      let end = approveReq.end_time
      if (!start.includes('T')) start += 'T09:00:00'
      if (!end.includes('T')) end += 'T17:00:00'
      if (typeof start === 'string' && start.length === 16) start += ':00'
      if (typeof end === 'string' && end.length === 16) end += ':00'
      await api.approveRequest(approveReq.requestId, { start_time: start, end_time: end, instructions: approveReq.instructions ?? '' })
      setApproveReq(null)
      await loadThread(selected)
      await loadConversations()
    } catch (err) {
      setError(err.message || 'Failed to approve')
    } finally {
      setProcessing(null)
    }
  }

  async function handleRejectRequest(requestId) {
    setError('')
    try {
      await api.rejectRequest(requestId)
      await loadThread(selected)
      await loadConversations()
    } catch (err) {
      setError(err.message || 'Failed to reject')
    }
  }

  async function handleDeleteConversation(requestId) {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
    setError('')
    try {
      await api.deleteConversation(requestId)
      const remaining = conversations.filter((c) => c.id !== requestId)
      setConversations(remaining)
      setSelected(remaining.length > 0 ? remaining[0].id : null)
      setThread([])
      setOtherUser(null)
      setConversationMeta(null)
    } catch (err) {
      setError(err.message || 'Failed to delete')
    }
  }

  return (
    <div className="rounded-xl border border-gray-200/60 bg-puaa-surface overflow-hidden flex flex-col min-h-[480px] max-h-[560px] shadow-lg">
      <div className="flex flex-1 min-h-0">
        {/* Conversation list - left sidebar */}
        <div className="w-72 md:w-80 border-r border-gray-200/60 flex flex-col shrink-0 bg-puaa-cream/50">
          <div className="px-4 py-3 border-b border-gray-200/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {isHunter ? 'Your conversations' : 'Messages from hunters'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isHunter ? 'Message landowners about properties' : 'Respond to access requests'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadConversations()}
                disabled={loading}
                className="text-xs py-1.5 px-3 rounded-md border border-gray-200 text-gray-600 font-medium hover:bg-puaa-cream/60 disabled:opacity-50 shrink-0"
              >
                Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-gray-500">
                {isHunter
                  ? "No conversations yet. Request access to a sighting to start messaging the landowner."
                  : 'No messages yet. When hunters request access, they appear here.'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto" ref={listEndRef}>
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`w-full text-left px-4 py-3 border-b border-gray-200/40 transition flex gap-3 items-center ${
                    selected === c.id ? 'bg-puaa-cream/70 border-l-4 border-l-puaa-forest' : 'hover:bg-puaa-cream/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className="flex-1 flex gap-3 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-puaa-sage/40 flex items-center justify-center shrink-0 text-puaa-forest font-semibold text-sm">
                      {(c.other_user?.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {c.other_user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {c.property_name || `Sighting #${c.sighting_id}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {c.last_message?.body || c.initial_message || 'No messages yet'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatTime(c.last_message?.created_at || c.created_at)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.id) }}
                    className="text-xs py-1 px-2 rounded text-red-600 hover:bg-red-50 shrink-0"
                    title="Delete conversation"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat thread - right panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-puaa-surface/80">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200/50 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-puaa-sage/40 flex items-center justify-center text-puaa-forest font-semibold text-sm">
                  {(otherUser?.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{otherUser?.name || 'Unknown'}</div>
                  <div className="text-xs text-gray-500">{conversationMeta?.property_name || ''}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {!isHunter && conversationMeta?.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          const { start, end } = defaultApproveDates()
                          setApproveReq({ requestId: selected, start_time: start, end_time: end, instructions: '' })
                        }}
                        className="text-xs py-1.5 px-3 rounded-md bg-puaa-forest text-white font-medium hover:bg-puaa-bark"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectRequest(selected)}
                        className="text-xs py-1.5 px-3 rounded-md border border-gray-200 text-gray-600 font-medium hover:bg-puaa-cream/60"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {conversationMeta?.status && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        conversationMeta.status === 'approved'
                          ? 'bg-green-50 text-green-700'
                          : conversationMeta.status === 'rejected'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {conversationMeta.status}
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <div className="mx-4 mt-2 p-2 rounded bg-red-50 text-red-600 text-sm">{error}</div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {thread.map((m) => {
                  const isMe = m.sender_user_id === user?.id
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMe
                            ? 'bg-puaa-forest text-white rounded-br-md'
                            : 'bg-puaa-surface text-gray-900 rounded-bl-md border border-gray-200/50'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isMe ? 'text-white/80' : 'text-gray-400'
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="p-4 border-t border-gray-200/50 shrink-0"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 text-sm rounded-full border border-gray-200/60 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-puaa-forest focus:border-puaa-forest"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="shrink-0 px-5 py-2.5 text-sm font-medium rounded-full bg-puaa-forest text-white hover:bg-puaa-bark disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-puaa-cream flex items-center justify-center text-gray-400 text-2xl mb-4">
                  💬
                </div>
                <p className="text-sm text-gray-500">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approve modal for landowners */}
      {approveReq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-puaa-surface rounded-lg max-w-md w-full p-6 border border-gray-200/80 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Set booking window</h2>
            <form onSubmit={handleApproveRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={approveReq.start_time?.slice(0, 16) ?? ''}
                  onChange={(e) => setApproveReq({ ...approveReq, start_time: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-puaa-forest"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                <input
                  type="datetime-local"
                  value={approveReq.end_time?.slice(0, 16) ?? ''}
                  onChange={(e) => setApproveReq({ ...approveReq, end_time: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-puaa-forest"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Instructions (optional)</label>
                <textarea
                  value={approveReq.instructions ?? ''}
                  onChange={(e) => setApproveReq({ ...approveReq, instructions: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-puaa-forest"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="py-2 px-4 text-sm rounded-lg bg-puaa-forest text-white font-medium hover:bg-puaa-bark disabled:opacity-60"
                >
                  {processing ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setApproveReq(null)}
                  className="py-2 px-4 text-sm rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-puaa-cream/60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
