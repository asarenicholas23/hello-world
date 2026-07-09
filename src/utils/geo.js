const EARTH_RADIUS_M = 6371000

/** Great-circle distance between two { lat, lng } points, in meters. */
export function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function isWithinGeofence(point, center, radiusMeters) {
  return distanceMeters(point, center) <= radiusMeters
}
