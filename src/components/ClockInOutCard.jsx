import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { LogIn, LogOut, AlertCircle, Loader, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getTodayAttendance, clockIn, clockOut } from '../firebase/attendance'
import { distanceMeters } from '../utils/geo'
import { fmtTime } from '../utils/records'
import { OFFICE_LOCATION } from '../data/constants'

export default function ClockInOutCard() {
  const { user, staff } = useAuth()
  const { isOnline } = useSync()
  const { coordinates, loading: gpsLoading, error: gpsError, capture, clear } = useGPS()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTodayAttendance(user.uid)
      .then(setRecord)
      .catch(() => setError('Failed to load attendance status.'))
      .finally(() => setLoading(false))
  }, [user.uid])

  async function handleClockIn() {
    setError('')
    if (!isOnline) { setError('Clock in requires an internet connection — try again once connected.'); return }
    await capture()
  }

  async function handleClockOut() {
    setError('')
    if (!isOnline) { setError('Clock out requires an internet connection — try again once connected.'); return }
    await capture()
  }

  // Once GPS resolves (triggered by either button), check geofence and submit.
  useEffect(() => {
    if (!coordinates) return

    async function submit() {
      const distance = distanceMeters(coordinates, OFFICE_LOCATION)
      // Desktop/web browsers have no GPS chip and fall back to IP-based
      // location, which can be off by hundreds of kilometers — only enforce
      // the geofence on the native mobile app, where GPS is reliable.
      if (Capacitor.isNativePlatform() && distance > OFFICE_LOCATION.radiusMeters) {
        setError(`You are ${Math.round(distance)}m away from the office (must be within ${OFFICE_LOCATION.radiusMeters}m).`)
        clear()
        return
      }

      setSubmitting(true)
      try {
        if (!record) {
          await clockIn(user.uid, staff?.name ?? '', staff?.role ?? '', coordinates, distance)
        } else {
          await clockOut(user.uid, coordinates, distance)
        }
        const fresh = await getTodayAttendance(user.uid)
        setRecord(fresh)
        clear()
      } catch (err) {
        setError(err.message)
      } finally {
        setSubmitting(false)
      }
    }
    submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates])

  if (loading) return null

  const busy = submitting || gpsLoading

  return (
    <div className="clock-widget">
      <div className="clock-widget__info">
        {!record && <div className="clock-widget__status">You haven&apos;t clocked in today.</div>}
        {record && !record.clock_out_at && (
          <div className="clock-widget__status">
            <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> Clocked in at {fmtTime(record.clock_in_at)}
          </div>
        )}
        {record && record.clock_out_at && (
          <div className="clock-widget__status">
            <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> Clocked in {fmtTime(record.clock_in_at)} · Clocked out {fmtTime(record.clock_out_at)} — done for today.
          </div>
        )}
        {(error || gpsError) && (
          <div className="clock-widget__error"><AlertCircle size={14} /> {error || gpsError}</div>
        )}
      </div>

      {!record?.clock_out_at && (
        <button
          type="button"
          className={`btn ${record ? 'btn--danger' : 'btn--primary'} clock-widget__btn`}
          onClick={record ? handleClockOut : handleClockIn}
          disabled={busy}
        >
          {busy
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> {gpsLoading ? 'Getting location…' : 'Saving…'}</>
            : record ? <><LogOut size={15} /> Clock Out</> : <><LogIn size={15} /> Clock In</>
          }
        </button>
      )}
    </div>
  )
}
