
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');

const openrouterKey = functions.params.defineSecret('OPENROUTER_KEY');
const facilityIdPattern = /\b(?:CI|CU|CH|CT|CE|PP|CA|CM)\d+\b/gi

async function resolveAuth(data, context) {
  if (context?.auth) return context.auth
  if (data?.auth) return data.auth

  const rawRequest = data?.rawRequest
  const authHeader = rawRequest?.headers?.authorization || rawRequest?.headers?.Authorization
  const token = authHeader?.split('Bearer ')[1] || authHeader?.split('bearer ')[1]
  if (!token) return null

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    return { uid: decoded.uid, token: decoded, rawToken: token }
  } catch (err) {
    console.error('chatbot verifyIdToken failed', err)
    return null
  }
}

function normalizeText(text) {
  return String(text ?? '').trim()
}

function formatDate(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toISOString().split('T')[0]
  }
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().split('T')[0]
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return formatDate(value.toDate())
  }
  if (typeof value === 'object' && value.seconds != null) {
    return formatDate(new Date(value.seconds * 1000))
  }
  return String(value)
}

function extractFacilityId(text) {
  if (!text) return null
  const matches = text.match(facilityIdPattern)
  return matches?.[0]?.toUpperCase() ?? null
}

async function searchFacilitiesByName(db, query) {
  if (!query || query.length < 2) return []
  
  const facilitiesSnap = await db.collection('facilities').get()
  const matchingFacilities = []
  
  for (const doc of facilitiesSnap.docs) {
    const data = doc.data()
    const name = normalizeText(data.name)
    if (name && name.toLowerCase().includes(query.toLowerCase())) {
      matchingFacilities.push({
        id: doc.id,
        name: name,
        data: data
      })
    }
  }
  
  return matchingFacilities.slice(0, 5) // Limit to 5 results
}

function truncate(text, maxLength = 6200) {
  const value = normalizeText(text)
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 20)}... [truncated]`
}

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

async function createEmbeddings(openai, inputs) {
  if (!Array.isArray(inputs)) inputs = [inputs]
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: inputs,
  })
  return response.data.map((item) => item.embedding)
}

function summaryForRecord(category, record) {
  switch (category) {
    case 'permits':
      return `Permit ${record.permit_number ?? record.id}: issued ${formatDate(record.issue_date) ?? 'unknown'}, expires ${formatDate(record.expiry_date) ?? 'unknown'}, location ${record.issue_location ?? 'unknown'}`
    case 'finance':
      return `Finance ${record.reference_number ?? record.id}: ${record.payment_type ?? 'unknown'} ${record.amount != null ? `GHS ${record.amount}` : ''} ${record.payment_status || 'paid'}${record.permit_number ? ` for permit ${record.permit_number}` : ''}`
    case 'screenings':
      return `Screening ${record.id}: district ${record.district ?? 'unknown'}, notes ${normalizeText(record.notes).slice(0, 80)}`
    case 'site_verifications':
      return `Site verification ${record.id}: district ${record.district ?? 'unknown'}, notes ${normalizeText(record.notes).slice(0, 80)}`
    case 'monitoring':
      return `Monitoring ${record.id}: district ${record.district ?? 'unknown'}, notes ${normalizeText(record.notes).slice(0, 80)}`
    case 'enforcement':
      return `Enforcement ${record.id}: invoice status ${record.invoice_status ?? record.payment_status ?? 'unknown'}, notes ${normalizeText(record.notes).slice(0, 80)}`
    default:
      return `${category} ${record.id}: ${JSON.stringify(record).slice(0, 120)}`
  }
}

async function fetchFacilityContext(db, fileNumber) {
  const facilityRef = db.collection('facilities').doc(fileNumber)
  const facilitySnap = await facilityRef.get()
  if (!facilitySnap.exists) return null

  const facilityData = facilitySnap.data()
  const subcategories = ['permits', 'finance', 'screenings', 'site_verifications', 'monitoring', 'enforcement']

  const subcollectionResults = await Promise.all(
    subcategories.map(async (name) => {
      const snap = await facilityRef.collection(name).get()
      return {
        name,
        records: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      }
    })
  )

  return { fileNumber, facilityData, subcollectionResults }
}

function buildFacilityContextSummary({ fileNumber, facilityData, subcollectionResults }) {
  const lines = []
  lines.push(`Facility ${fileNumber}`)
  lines.push(`Name: ${facilityData.name ?? 'unknown'}`)
  lines.push(`Sector: ${facilityData.sector ?? facilityData.sector_prefix ?? 'unknown'}`)
  lines.push(`District: ${facilityData.district ?? 'unknown'}`)
  lines.push(`Location: ${facilityData.location ?? 'unknown'}`)
  if (facilityData.contact_person) lines.push(`Contact: ${facilityData.contact_person} (${facilityData.phone ?? 'no phone'})`)
  if (facilityData.email) lines.push(`Email: ${facilityData.email}`)
  if (facilityData.type_of_undertaking) lines.push(`Type of undertaking: ${facilityData.type_of_undertaking}`)

  for (const section of subcollectionResults) {
    if (!section.records.length) continue
    lines.push(`\n${section.name.replace('_', ' ').toUpperCase()} (${section.records.length})`)
    const preview = section.records.slice(0, 3).map((record) => `- ${summaryForRecord(section.name, record)}`)
    lines.push(...preview)
  }

  return truncate(lines.join('\n'), 3000)
}

function chooseTop(list, limit = 3) {
  return list
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function buildAnalyticsSummary({ facilityCount, financeCount, permitCount, screeningCount, siteVerificationCount, monitoringCount, enforcementCount, complaintCount, envEducationCount, fieldReportCount, totalPaidRevenue, totalUnpaid, totalRevenue, topDistrictByRevenue, topSectorByRevenue, topDistrictByUnpaid, topSectorByUnpaid }) {
  const lines = []
  lines.push('GLOBAL ANALYTICS SUMMARY')
  lines.push(`Facilities: ${facilityCount}`)
  lines.push(`Finance records: ${financeCount}`)
  lines.push(`Permits: ${permitCount}`)
  lines.push(`Screenings: ${screeningCount}`)
  lines.push(`Site verifications: ${siteVerificationCount}`)
  lines.push(`Monitoring records: ${monitoringCount}`)
  lines.push(`Enforcement records: ${enforcementCount}`)
  lines.push(`Complaints: ${complaintCount}`)
  lines.push(`Environmental education records: ${envEducationCount}`)
  lines.push(`Field reports: ${fieldReportCount}`)
  lines.push(`Total revenue (paid + unpaid): GHS ${totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  lines.push(`Total paid revenue: GHS ${totalPaidRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  lines.push(`Total unpaid amount: GHS ${totalUnpaid.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  if (topDistrictByRevenue) lines.push(`Top district by paid revenue: ${topDistrictByRevenue.key} with GHS ${topDistrictByRevenue.value.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  if (topSectorByRevenue) lines.push(`Top sector by paid revenue: ${topSectorByRevenue.key} with GHS ${topSectorByRevenue.value.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  if (topDistrictByUnpaid) lines.push(`Top district by unpaid amount: ${topDistrictByUnpaid.key} with GHS ${topDistrictByUnpaid.value.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  if (topSectorByUnpaid) lines.push(`Top sector by unpaid amount: ${topSectorByUnpaid.key} with GHS ${topSectorByUnpaid.value.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`)
  return truncate(lines.join('\n'), 3200)
}

async function fetchGlobalAnalytics(db) {
  const [facilitiesSnap, financeSnap, permitsSnap, screeningsSnap, siteVerificationSnap, monitoringSnap, enforcementSnap, complaintsSnap, envEducationSnap, fieldReportsSnap] = await Promise.all([
    db.collection('facilities').get(),
    db.collectionGroup('finance').get(),
    db.collectionGroup('permits').get(),
    db.collectionGroup('screenings').get(),
    db.collectionGroup('site_verifications').get(),
    db.collectionGroup('monitoring').get(),
    db.collectionGroup('enforcement').get(),
    db.collection('complaints').get(),
    db.collection('environmental_education').get(),
    db.collection('field_reports').get(),
  ])

  const facilityMap = new Map(facilitiesSnap.docs.map((doc) => {
    const data = doc.data()
    return [doc.id, { district: data.district ?? 'unknown', sector: data.sector ?? data.sector_prefix ?? 'unknown' }]
  }))

  const revenueByDistrict = {}
  const unpaidByDistrict = {}
  const revenueBySector = {}
  const unpaidBySector = {}
  let totalPaidRevenue = 0
  let totalUnpaid = 0
  let totalRevenue = 0

  financeSnap.docs.forEach((financeDoc) => {
    const record = financeDoc.data()
    const facilityId = financeDoc.ref.parent.parent.id
    const facilityInfo = facilityMap.get(facilityId) || { district: 'unknown', sector: 'unknown' }
    const amount = Number(record.amount ?? 0)
    const status = String(record.payment_status ?? 'paid').toLowerCase()
    totalRevenue += amount
    if (status === 'unpaid') {
      totalUnpaid += amount
      unpaidByDistrict[facilityInfo.district] = (unpaidByDistrict[facilityInfo.district] ?? 0) + amount
      unpaidBySector[facilityInfo.sector] = (unpaidBySector[facilityInfo.sector] ?? 0) + amount
    } else {
      totalPaidRevenue += amount
      revenueByDistrict[facilityInfo.district] = (revenueByDistrict[facilityInfo.district] ?? 0) + amount
      revenueBySector[facilityInfo.sector] = (revenueBySector[facilityInfo.sector] ?? 0) + amount
    }
  })

  const topDistrictByRevenue = chooseTop(Object.entries(revenueByDistrict).map(([key, value]) => ({ key, value })))[0] || null
  const topSectorByRevenue = chooseTop(Object.entries(revenueBySector).map(([key, value]) => ({ key, value })))[0] || null
  const topDistrictByUnpaid = chooseTop(Object.entries(unpaidByDistrict).map(([key, value]) => ({ key, value })))[0] || null
  const topSectorByUnpaid = chooseTop(Object.entries(unpaidBySector).map(([key, value]) => ({ key, value })))[0] || null

  return {
    facilityCount: facilitiesSnap.size,
    financeCount: financeSnap.size,
    permitCount: permitsSnap.size,
    screeningCount: screeningsSnap.size,
    siteVerificationCount: siteVerificationSnap.size,
    monitoringCount: monitoringSnap.size,
    enforcementCount: enforcementSnap.size,
    complaintCount: complaintsSnap.size,
    envEducationCount: envEducationSnap.size,
    fieldReportCount: fieldReportsSnap.size,
    totalPaidRevenue,
    totalUnpaid,
    totalRevenue,
    topDistrictByRevenue,
    topSectorByRevenue,
    topDistrictByUnpaid,
    topSectorByUnpaid,
  }
}

async function fetchFacilitiesWithoutPermits(db) {
  const facilitiesSnap = await db.collection('facilities').get()
  const facilitiesWithoutPermits = []

  for (const facilityDoc of facilitiesSnap.docs) {
    const permitsSnap = await facilityDoc.ref.collection('permits').get()
    if (permitsSnap.empty) {
      facilitiesWithoutPermits.push(facilityDoc.id)
    }
  }

  return facilitiesWithoutPermits
}

async function fetchExpiredPermitsForFacility(db, facilityId) {
  const facilityRef = db.collection('facilities').doc(facilityId)
  const permitsSnap = await facilityRef.collection('permits').get()
  const expiredPermits = []

  const now = new Date()
  for (const permitDoc of permitsSnap.docs) {
    const permit = permitDoc.data()
    if (permit.expiry_date) {
      const expiry = new Date(permit.expiry_date)
      if (expiry < now) {
        expiredPermits.push({
          id: permitDoc.id,
          permit_number: permit.permit_number,
          expiry_date: permit.expiry_date,
        })
      }
    }
  }

  return expiredPermits
}

// Force redeploy - added comment
async function buildSemanticContext(openai, db, query) {
  const facilitiesSnap = await db.collection('facilities').get()
  const facilityCandidates = facilitiesSnap.docs.map((facilityDoc) => {
    const data = facilityDoc.data()
    const summaryParts = [
      `Facility ${facilityDoc.id}`,
      data.name ? `name ${data.name}` : null,
      data.sector ? `sector ${data.sector}` : null,
      data.sector_prefix ? `sector prefix ${data.sector_prefix}` : null,
      data.district ? `district ${data.district}` : null,
      data.location ? `location ${data.location}` : null,
      data.type_of_undertaking ? `undertaking ${data.type_of_undertaking}` : null,
      data.contact_person ? `contact ${data.contact_person}` : null,
    ].filter(Boolean).join(', ')
    return {
      id: facilityDoc.id,
      text: summaryParts,
      kind: 'facility',
    }
  })

  if (!facilityCandidates.length) return ''

  const queryEmbedding = (await createEmbeddings(openai, query))[0]
  const candidates = facilityCandidates.slice(0, 80)
  const candidateTexts = candidates.map((candidate) => candidate.text)
  const candidateEmbeddings = await createEmbeddings(openai, candidateTexts)

  const ranked = candidates.map((candidate, index) => ({
    ...candidate,
    score: cosineSimilarity(queryEmbedding, candidateEmbeddings[index]),
  })).sort((a, b) => b.score - a.score).slice(0, 6)

  const lines = ranked.map((candidate) => `- ${candidate.id}: ${candidate.text}`)
  return `Most relevant facilities to this question:\n${lines.join('\n')}`
}

async function fetchExpiredPermitsForFacility(db, facilityId) {
  const facilityRef = db.collection('facilities').doc(facilityId)
  const permitsSnap = await facilityRef.collection('permits').get()
  const expiredPermits = []

  const now = new Date()
  for (const permitDoc of permitsSnap.docs) {
    const permit = permitDoc.data()
    if (permit.expiry_date) {
      const expiry = new Date(permit.expiry_date)
      if (expiry < now) {
        expiredPermits.push({
          id: permitDoc.id,
          permit_number: permit.permit_number,
          expiry_date: permit.expiry_date,
        })
      }
    }
  }

  return expiredPermits
}

exports.chatbot = functions.https.onCall({ secrets: [openrouterKey] }, async (data, context) => {
  const authContext = await resolveAuth(data, context)
  const messagePayload = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(data?.data?.messages)
      ? data.data.messages
      : []

  console.log('chatbot invocation', {
    auth: authContext ? { uid: authContext.uid, tokenType: authContext.token ? 'present' : 'missing' } : null,
    messageCount: messagePayload.length,
    dataKeys: Object.keys(data || {}),
  })

  if (!authContext) {
    console.error('chatbot unauthenticated request', { dataKeys: Object.keys(data || {}), data })
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  const db = admin.firestore()

  try {
    const userMessage = messagePayload.filter((msg) => msg.role === 'user').map((msg) => msg.content).join(' ')
    const facilityId = extractFacilityId(userMessage)
    const contextSections = []

    // Check for specific query types
    const lowerMessage = userMessage.toLowerCase()
    const isQueryWithoutPermits = lowerMessage.includes('without permit') || lowerMessage.includes('no permit') || lowerMessage.includes('missing permit')
    const isQueryExpiredPermit = lowerMessage.includes('expired permit') && facilityId

    let specificFacilities = []
    
    if (facilityId) {
      const facilityContext = await fetchFacilityContext(db, facilityId)
      if (facilityContext) {
        contextSections.push(`FACILITY-SPECIFIC CONTEXT\n${buildFacilityContextSummary(facilityContext)}`)
        specificFacilities.push(facilityId)
      } else {
        contextSections.push(`FACILITY-SPECIFIC CONTEXT\nNo facility document found for ${facilityId}.`)
      }
    } else {
      // Try to find facilities by name
      const nameMatches = await searchFacilitiesByName(db, userMessage)
      if (nameMatches.length > 0) {
        const facilitySummaries = nameMatches.map(match => {
          const context = {
            fileNumber: match.id,
            facilityData: match.data,
            subcollectionResults: []
          }
          return buildFacilityContextSummary(context)
        })
        contextSections.push(`FACILITIES MATCHING NAME QUERY\n${facilitySummaries.join('\n\n')}`)
        specificFacilities = nameMatches.map(match => match.id)
      }
    }

    // Handle expired permits query for specific facilities
    if (isQueryExpiredPermit && specificFacilities.length > 0) {
      for (const facilityId of specificFacilities) {
        const expiredPermits = await fetchExpiredPermitsForFacility(db, facilityId)
        if (expiredPermits.length > 0) {
          const expiredList = expiredPermits.map(p => `- Permit ${p.permit_number} expired on ${p.expiry_date}`).join('\n')
          contextSections.push(`EXPIRED PERMITS FOR ${facilityId}\n${expiredList}`)
        } else {
          contextSections.push(`EXPIRED PERMITS FOR ${facilityId}\nNo expired permits found.`)
        }
      }
    }

    if (isQueryWithoutPermits) {
      const facilitiesWithoutPermits = await fetchFacilitiesWithoutPermits(db)
      contextSections.push(`FACILITIES WITHOUT PERMITS\nThere are ${facilitiesWithoutPermits.length} facilities without permits on file: ${facilitiesWithoutPermits.join(', ')}`)
    }

    const analytics = await fetchGlobalAnalytics(db)
    contextSections.push(buildAnalyticsSummary(analytics))

    const semanticContext = await buildSemanticContext(openai, db, userMessage || 'EPA data')
      .catch(err => {
        console.error('Semantic context build failed:', err.message)
        return ''
      })
    if (semanticContext) {
      contextSections.push(`SEMANTIC SEARCH CONTEXT\n${semanticContext}`)
    }

    const systemPrompt = `You are Osei, a Ghana EPA assistant. Use only the data provided in the context sections below. Answer clearly and concisely. If the user asks about a specific facility, use the facility context. If the user asks about broader finance or district/sector analytics, use the global analytics summary. For queries about facilities without permits or expired permits, use the specific sections provided. If the answer is not contained in the provided app data, say you do not have enough information in the app data to answer. You cannot perform actions like editing records or assigning facilities; you can only provide information and suggestions.`

    console.log('chatbot context', { facilityId, contextSectionsCount: contextSections.length, totalContextLength: contextSections.join('\n\n').length })

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: truncate(contextSections.join('\n\n')) },
        ...messagePayload,
      ],
      max_tokens: 500,
    });

    return { reply: response.choices[0].message.content };
  } catch (error) {
    console.error('OpenRouter API error:', {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data ?? null,
    });
    throw new functions.https.HttpsError('internal', 'Failed to get chatbot response');
  }
});
