import { createContext, useContext, useState, type ReactNode } from 'react'
import type { StaffMember } from '../types'

const STORAGE_KEY = '3dm_staff'

interface StaffAuthValue {
  member: StaffMember | null
  login: (member: StaffMember) => void
  logout: () => void
}

const StaffAuthContext = createContext<StaffAuthValue | null>(null)

function loadFromSession(): StaffMember | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StaffMember) : null
  } catch {
    return null
  }
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<StaffMember | null>(loadFromSession)

  function login(m: StaffMember) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m))
    setMember(m)
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY)
    setMember(null)
  }

  return (
    <StaffAuthContext.Provider value={{ member, login, logout }}>
      {children}
    </StaffAuthContext.Provider>
  )
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext)
  if (!ctx) throw new Error('useStaffAuth must be used inside <StaffAuthProvider>')
  return ctx
}
