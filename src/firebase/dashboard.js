import { collectionGroup, getDocs } from 'firebase/firestore'
import { db } from './config'
import { listFacilities } from './facilities'

export async function getDashboardStats() {
  const facilities = await listFacilities()

  const bySector = {}
  const byDistrict = {}
  facilities.forEach((f) => {
    bySector[f.sector_prefix] = (bySector[f.sector_prefix] || 0) + 1
    if (f.district) byDistrict[f.district] = (byDistrict[f.district] || 0) + 1
  })

  return {
    total: facilities.length,
    bySector,
    byDistrict,
    recent: facilities.slice(0, 5),
  }
}

export async function getPermitStats() {
  const snap = await getDocs(collectionGroup(db, 'permits'))
  const now = Date.now()
  const in60 = now + 60 * 24 * 60 * 60 * 1000

  let active = 0, expiring = 0, expired = 0

  snap.docs.forEach((d) => {
    const ts = d.data().expiry_date
    if (!ts) return
    const ms = ts.toMillis()
    if (ms < now) expired++
    else if (ms < in60) expiring++
    else active++
  })

  return { total: snap.size, active, expiring, expired }
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
    const fileNumber = d.ref.parent.parent.id
    return {
      id: d.id,
      fileNumber,
      facilityName: facilityMap[fileNumber]?.name ?? fileNumber,
      sectorPrefix: facilityMap[fileNumber]?.sector_prefix ?? '',
      ...d.data(),
    }
  })
}

export async function buildFacilityMap() {
  const facilities = await listFacilities()
  return Object.fromEntries(
    facilities.map((f) => [f.file_number, { name: f.name, file_number: f.file_number, sector_prefix: f.sector_prefix }])
  )
}
