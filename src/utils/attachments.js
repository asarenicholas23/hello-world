function withProtocol(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^\/template\/gettablefileurl/i.test(trimmed)) return `https://www.appsheet.com${trimmed}`
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  if (/^(drive|docs)\.google\.com\//i.test(trimmed)) return `https://${trimmed}`
  if (/^(www\.)?appsheet\.com\//i.test(trimmed)) return `https://${trimmed.replace(/^www\./i, 'www.')}`
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function extractGoogleDriveFileId(value) {
  const url = withProtocol(value)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const { hostname, pathname, searchParams } = parsed
    if (!hostname.includes('google.com')) return ''

    const filePathMatch = pathname.match(/\/file\/d\/([^/]+)/i)
    if (filePathMatch) return filePathMatch[1]

    const docPathMatch = pathname.match(/\/document\/d\/([^/]+)/i)
    if (docPathMatch) return docPathMatch[1]

    const sheetPathMatch = pathname.match(/\/spreadsheets\/d\/([^/]+)/i)
    if (sheetPathMatch) return sheetPathMatch[1]

    const presentationPathMatch = pathname.match(/\/presentation\/d\/([^/]+)/i)
    if (presentationPathMatch) return presentationPathMatch[1]

    return searchParams.get('id') || ''
  } catch {
    return ''
  }
}

export function normalizeAttachmentUrl(value) {
  const url = withProtocol(value)
  if (!url) return ''

  const driveFileId = extractGoogleDriveFileId(url)
  if (driveFileId) {
    // Canonical Drive viewer URL works better than storing arbitrary share-link variants.
    return `https://drive.google.com/file/d/${driveFileId}/view`
  }

  return url
}
