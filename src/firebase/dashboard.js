import { collection, collectionGroup, getDocs } from 'firebase/firestore'
import { db } from './config'
import { listFacilities } from './facilities'
import { isPermitStuck } from '../data/workflow'
import { decodeFileNumberParam } from '../utils/fileNumbers'

function quarterRange() {
  const now  = new Date()
  const q    = Math.floor(now.getMonth() / 3)
  const year = now.getFullYear()
  const labels = ['Q1 Jan–Mar', 'Q2 Apr–Jun', 'Q3 Jul–Sep', 'Q4 Oct–Dec']
  return {
    start: new Date(year, q * 3, 1).getTime(),
    end:   new Date(year, (q + 1) * 3, 0, 23, 59, 59, 999).getTime(),
    label: `${labels[q]} ${year}`,
  }
}

function tsMs(ts) {
  if (!ts) return 0
  return ts.toMillis ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : 0
}

export async function getMyActivityStats(uid, startMs, endMs) {
  let start, end, label
  if (startMs != null && endMs != null) {
    start = startMs
    end   = endMs
    const fmt = (ms) => new Date(ms).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
    label = `${fmt(startMs)} – ${fmt(endMs)}`
  } else {
    const q = quarterRange()
    start = q.start
    end   = q.end
    label = q.label
  }

  const [screenSnap, monSnap, enfSnap, siteSnap, permitSnap, complaintsSnap, envEdSnap, facilities] = await Promise.all([
    getDocs(collectionGroup(db, 'screenings')),
    getDocs(collectionGroup(db, 'monitoring')),
    getDocs(collectionGroup(db, 'enforcement')),
    getDocs(collectionGroup(db, 'site_verifications')),
    getDocs(collectionGroup(db, 'permits')),
    getDocs(collection(db, 'complaints')),
    getDocs(collection(db, 'environmental_education')),
    listFacilities(),
  ])

  function countMine(snap) {
    return snap.docs.filter((d) => {
      const data = d.data()
      return data.created_by === uid && tsMs(data.created_at) >= start && tsMs(data.created_at) <= end
    }).length
  }

  const myFacilityNums = new Set(facilities.filter((f) => f.primary_officer === uid).map((f) => f.file_number))

  return {
    quarterLabel:       label,
    assignedFacilities: myFacilityNums.size,
    screenings:         countMine(screenSnap),
    monitoring:         countMine(monSnap),
    enforcement:        countMine(enfSnap),
    siteVerifications:  countMine(siteSnap),
    permits:            permitSnap.docs.filter((d) => myFacilityNums.has(decodeFileNumberParam(d.ref.parent.parent.id))).length,
    complaints:         countMine(complaintsSnap),
    envEducation:       countMine(envEdSnap),
  }
}

export async function getDashboardStats() {
  const [facilities, permitSnap] = await Promise.all([
    listFacilities(),
    getDocs(collectionGroup(db, 'permits')),
  ])

  const bySector = {}
  const byDistrict = {}
  let stuckWorkflow = 0

  facilities.forEach((f) => {
    bySector[f.sector_prefix] = (bySector[f.sector_prefix] || 0) + 1
    if (f.district) byDistrict[f.district] = (byDistrict[f.district] || 0) + 1
    if (isPermitStuck(f)) stuckWorkflow++
  })

  const facilitiesWithPermit = new Set(
    permitSnap.docs.map((d) => decodeFileNumberParam(d.ref.parent.parent.id))
  )
  const withoutPermits = facilities.filter((f) => !facilitiesWithPermit.has(f.file_number)).length

  return {
    total: facilities.length,
    withoutPermits,
    stuckWorkflow,
    bySector,
    byDistrict,
    recent: facilities.slice(0, 5),
  }
}

export async function getFieldStats() {
  const [screenings, monitoring, enforcement, siteVerifications] = await Promise.all([
    getDocs(collectionGroup(db, 'screenings')),
    getDocs(collectionGroup(db, 'monitoring')),
    getDocs(collectionGroup(db, 'enforcement')),
    getDocs(collectionGroup(db, 'site_verifications')),
  ])
  return {
    screenings:       screenings.size,
    monitoring:       monitoring.size,
    enforcement:      enforcement.size,
    siteVerifications:siteVerifications.size,
  }
}

export async function getPermitStats() {
  const statusMap = await getPermitStatusMap()
  const statuses = Object.values(statusMap)

  return {
    total: statuses.length,
    active: statuses.filter((status) => status === 'active').length,
    expiring: statuses.filter((status) => status === 'expiring').length,
    expired: statuses.filter((status) => status === 'expired').length,
  }
}

/**
 * Load all records of a given subcollection category across all facilities,
 * joined with facility name + file_number from a pre-loaded facility map.
 *
 * @param {string} category  e.g. 'permits' | 'finance' | 'screenings' | ...
 * @param {Object} facilityMap  { [fileNumber]: { name, file_number, sector_prefix } }
 */
export async function getCrossRecords(category, facilityMap) {
  const snap = await getDocs(collectionGroup(db, category))
  return snap.docs.map((d) => {
    const fileNumber = decodeFileNumberParam(d.ref.parent.parent.id)
    const fac = facilityMap[fileNumber] ?? {}
    return {
      id: d.id,
      fileNumber,
      facilityName:        fac.name ?? fileNumber,
      facilityOfficer:     fac.primary_officer ?? '',
      sectorPrefix:        fac.sector_prefix ?? '',
      facilitySector:      fac.sector ?? '',
      facilityUndertaking: fac.type_of_undertaking ?? '',
      facilityLocation:    fac.location ?? '',
      facilityDistrict:    fac.district ?? '',
      facilityContact:     fac.contact_person ?? '',
      facilityDesignation: fac.designation ?? '',
      facilityPhone:       fac.phone ?? '',
      facilityEmail:       fac.email ?? '',
      ...d.data(),
    }
  })
}

// Returns the "best" permit per facility (active > expiring > expired wins),
// including its status plus the dates/number needed for reporting exports.
export async function getPermitDetailsMap() {
  const snap = await getDocs(collectionGroup(db, 'permits'))
  const now   = Date.now()
  const in60  = now + 60 * 24 * 60 * 60 * 1000
  const map   = {}
  const rank  = { active: 3, expiring: 2, expired: 1 }
  snap.docs.forEach((d) => {
    const fileNumber = decodeFileNumberParam(d.ref.parent.parent.id)
    const data = d.data()
    const ms = data.expiry_date?.toMillis?.() ?? null
    let status = 'active'
    if (!ms)       status = 'active'
    else if (ms < now)  status = 'expired'
    else if (ms < in60) status = 'expiring'
    else               status = 'active'
    const existing = map[fileNumber]
    if (!existing || rank[status] > rank[existing.status]) {
      map[fileNumber] = {
        status,
        permit_number:  data.permit_number ?? '',
        issue_date:     data.issue_date ?? null,
        effective_date: data.effective_date ?? null,
        expiry_date:    data.expiry_date ?? null,
      }
    }
  })
  return map // { [fileNumber]: { status, permit_number, issue_date, effective_date, expiry_date } }
}

export async function getPermitStatusMap() {
  const details = await getPermitDetailsMap()
  return Object.fromEntries(Object.entries(details).map(([fileNumber, d]) => [fileNumber, d.status]))
  // { [fileNumber]: 'active' | 'expiring' | 'expired' }
}

// A facility is 'unpaid' if it has at least one unpaid finance record,
// otherwise 'paid' if it has any finance records at all. Facilities with
// no finance records don't appear in the map.
export async function getFinanceStatusMap() {
  const snap = await getDocs(collectionGroup(db, 'finance'))
  const map = {}
  snap.docs.forEach((d) => {
    const fileNumber = decodeFileNumberParam(d.ref.parent.parent.id)
    const status = (d.data().payment_status ?? 'paid') === 'unpaid' ? 'unpaid' : 'paid'
    if (!map[fileNumber] || status === 'unpaid') {
      map[fileNumber] = status
    }
  })
  return map // { [fileNumber]: 'unpaid' | 'paid' }
}

// Returns Set of fileNumbers that have at least one permit with ready_to_collect: true
export async function getPermitReadySet() {
  const snap = await getDocs(collectionGroup(db, 'permits'))
  const ready = new Set()
  snap.docs.forEach((d) => {
    if (d.data().ready_to_collect === true) {
      ready.add(decodeFileNumberParam(d.ref.parent.parent.id))
    }
  })
  return ready
}

export async function getFinanceStats(startMs, endMs) {
  const snap = await getDocs(collectionGroup(db, 'finance'))

  const totals = { revenue: 0, unpaid: 0 }
  const byType = {
    'Processing Fee': { revenue: 0, unpaid: 0, facilities: new Set() },
    'Permit Fee':     { revenue: 0, unpaid: 0, facilities: new Set() },
  }
  const facilitiesWithFinance = new Set()

  snap.docs.forEach((d) => {
    const data = d.data()
    // Date-range filter (optional)
    if (startMs != null && endMs != null) {
      const docMs = tsMs(data.date) || tsMs(data.created_at)
      if (docMs < startMs || docMs > endMs) return
    }
    const fileNumber = decodeFileNumberParam(d.ref.parent.parent.id)
    facilitiesWithFinance.add(fileNumber)
    const amount = Number(data.amount) || 0
    const isPaid = data.payment_status !== 'unpaid'
    const type   = data.payment_type ?? ''

    if (byType[type]) byType[type].facilities.add(fileNumber)

    if (isPaid) {
      totals.revenue += amount
      if (byType[type]) byType[type].revenue += amount
    } else {
      totals.unpaid += amount
      if (byType[type]) byType[type].unpaid += amount
    }
  })

  return {
    revenue:              totals.revenue,
    unpaid:               totals.unpaid,
    facilitiesWithFinance: facilitiesWithFinance.size,
    processingFee: {
      revenue: byType['Processing Fee'].revenue,
      unpaid: byType['Processing Fee'].unpaid,
      facilities: byType['Processing Fee'].facilities.size,
    },
    permitFee: {
      revenue: byType['Permit Fee'].revenue,
      unpaid: byType['Permit Fee'].unpaid,
      facilities: byType['Permit Fee'].facilities.size,
    },
  }
}

export async function buildFacilityMap() {
  const facilities = await listFacilities()
  return Object.fromEntries(
    facilities.map((f) => [f.file_number, {
      name:                f.name,
      file_number:         f.file_number,
      primary_officer:     f.primary_officer ?? null,
      sector_prefix:       f.sector_prefix,
      sector:              f.sector,
      type_of_undertaking: f.type_of_undertaking,
      location:            f.location,
      district:            f.district,
      contact_person:      f.contact_person,
      designation:         f.designation,
      phone:               f.phone,
      email:               f.email,
    }])
  )
}
