import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Building2, Briefcase } from 'lucide-react'
import { subscribeNotifications, markRead, markAllRead } from '../firebase/notifications'

function fmtTs(ts) {
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    const diff = Date.now() - d.getTime()
    if (diff < 60000)      return 'just now'
    if (diff < 3600000)    return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000)   return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

const TYPE_ICONS = {
  facility_assigned: Building2,
  supporting_assigned: Briefcase,
}

export default function NotificationBell({ uid }) {
  const navigate   = useNavigate()
  const [notifs, setNotifs]   = useState([])
  const [open, setOpen]       = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    const unsub = subscribeNotifications(uid, setNotifs)
    return unsub
  }, [uid])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter((n) => !n.read).length

  async function handleClick(n) {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.metadata?.fileNumber) navigate(`/facilities/${n.metadata.fileNumber}`)
  }

  async function handleMarkAll() {
    if (uid) await markAllRead(uid)
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        className={`notif-bell-btn${unread > 0 ? ' notif-bell-btn--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={`${unread} unread notifications`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">Notifications</span>
            {unread > 0 && (
              <button className="btn btn--ghost btn--xs" onClick={handleMarkAll} title="Mark all as read">
                <CheckCheck size={12} /> All read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              notifs.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell
                return (
                  <div
                    key={n.id}
                    className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                    onClick={() => handleClick(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick(n)}
                  >
                    <div className="notif-item__icon">
                      <Icon size={14} />
                    </div>
                    <div className="notif-item__body">
                      <div className="notif-item__msg">{n.message}</div>
                      <div className="notif-item__time">{fmtTs(n.created_at)}</div>
                    </div>
                    {!n.read && <div className="notif-item__dot" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
