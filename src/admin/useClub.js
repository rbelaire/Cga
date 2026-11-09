import { createContext, useContext } from 'react'

export const ClubContext = createContext(null)

export function useClub() {
  const value = useContext(ClubContext)
  if (!value) throw new Error('Club data is only available inside the admin.')
  return value
}
