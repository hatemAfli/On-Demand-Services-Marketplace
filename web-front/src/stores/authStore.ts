import { create } from 'zustand'
import type { WebConsoleUser } from '../types/user'

type AuthState = {
  user: WebConsoleUser | null
  authReady: boolean
  setUser: (user: WebConsoleUser | null) => void
  setAuthReady: (ready: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authReady: false,
  setUser: (user) => set({ user }),
  setAuthReady: (authReady) => set({ authReady }),
}))
