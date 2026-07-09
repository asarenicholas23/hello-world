import { OFFICE_HOURS } from '../data/constants'
import { dateStr } from './records'

/**
 * Attendance status computed on read (not stored), so tuning OFFICE_HOURS
 * later needs no backfill.
 * Returns one of: 'in_progress' | 'on_time' | 'late' | 'no_clock_out'
 */
export function getAttendanceStatus(record, officeHours = OFFICE_HOURS) {
  if (!record?.clock_in_at) return null

  const clockInDate = record.clock_in_at.toDate ? record.clock_in_at.toDate() : new Date(record.clock_in_at)
  const [startH, startM] = officeHours.start.split(':').map(Number)
  const graceMs = (officeHours.graceMinutes ?? 0) * 60 * 1000

  const expectedStart = new Date(clockInDate)
  expectedStart.setHours(startH, startM, 0, 0)

  const isLate = clockInDate.getTime() > expectedStart.getTime() + graceMs

  if (!record.clock_out_at) {
    return record.date === dateStr() ? 'in_progress' : 'no_clock_out'
  }
  return isLate ? 'late' : 'on_time'
}

export const ATTENDANCE_STATUS_LABEL = {
  in_progress:  'In Progress',
  on_time:      'On Time',
  late:         'Late',
  no_clock_out: 'Missed Clock-out',
}
