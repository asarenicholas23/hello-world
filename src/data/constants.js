export const SECTORS = [
  { prefix: 'CU', name: 'Manufacturing' },
  { prefix: 'CI', name: 'Infrastructure' },
  { prefix: 'CH', name: 'Health' },
  { prefix: 'CT', name: 'Hospitality' },
  { prefix: 'CE', name: 'Energy' },
  { prefix: 'PP', name: 'Agrochemical & Pesticide' },
  { prefix: 'CA', name: 'Agriculture' },
  { prefix: 'CM', name: 'Mining' },
]

export const DISTRICTS = [
  { code: 'KON', name: 'Konongo' },
  { code: 'KMA', name: 'Kumasi Metro' },
  { code: 'EJI', name: 'Ejisu' },
  { code: 'OBU', name: 'Obuasi' },
]

export const REGION = 'Ashanti'

// Color per sector prefix — used in cards and badges
export const SECTOR_COLORS = {
  CU: { bg: '#eff6ff', text: '#1d4ed8' },
  CI: { bg: '#f5f3ff', text: '#7c3aed' },
  CH: { bg: '#fdf4ff', text: '#a21caf' },
  CT: { bg: '#fff7ed', text: '#c2410c' },
  CE: { bg: '#fefce8', text: '#a16207' },
  PP: { bg: '#f0fdf4', text: '#15803d' },
  CA: { bg: '#ecfdf5', text: '#065f46' },
  CM: { bg: '#fdf2f8', text: '#be185d' },
}
