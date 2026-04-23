/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setStaff(null)
        setStaffError(null)
        setLoading(false)
        return
      }

      setUser(firebaseUser)

      try {
        const staffSnap = await getDoc(doc(db, 'staff', firebaseUser.uid))
        if (staffSnap.exists()) {
          const data = staffSnap.data()
          // Normalise role to lowercase so all comparisons are case-insensitive
          if (data.role) data.role = data.role.toLowerCase()
          setStaff(data)
          setStaffError(null)
        } else {
          setStaff(null)
          setStaffError('Your account is not registered as staff. Contact an administrator.')
        }
      } catch {
        setStaff(null)
        setStaffError('Failed to load your staff profile. Check your connection and try again.')
      }

      setLoading(false)
    })

    return unsub
  }, [])

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
    setUser(null)
    setStaff(null)
    setStaffError(null)
  }

  async function refreshStaff() {
    if (!auth.currentUser) return
    const snap = await getDoc(doc(db, 'staff', auth.currentUser.uid))
    if (snap.exists()) {
      const data = snap.data()
      if (data.role) data.role = data.role.toLowerCase()
      setStaff(data)
    }
  }

  const value = {
    user,
    staff,
    role:      staff?.role       ?? null,
    roleLevel: staff?.role_level ?? null,
    loading,
    staffError,
    login,
    logout,
    refreshStaff,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
