export function facilityDocId(fileNumber) {
  return encodeURIComponent(String(fileNumber ?? '').trim())
}

export function decodeFileNumberParam(value) {
  try {
    return decodeURIComponent(value ?? '')
  } catch {
    return value ?? ''
  }
}

export function facilityPath(fileNumber, suffix = '') {
  return `/facilities/${facilityDocId(fileNumber)}${suffix}`
}
