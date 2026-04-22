import { supabase } from '../lib/supabase'
import { api } from './api'
import {
  isWebAllowedRole,
  type WebConsoleUser,
  type UserRole,
} from '../types/user'

function isWebConsoleUser(u: unknown): u is WebConsoleUser {
  if (!u || typeof u !== 'object') return false
  const maybe = u as { role?: UserRole; email?: string }
  return !!maybe.email && !!maybe.role
}

function getRoleHomePath(role: UserRole): string {
  if (role === 'PLATFORM_ADMIN') return '/admin/dashboard'
  if (role === 'COMPANY_ADMIN') return '/company/dashboard'
  return '/access-blocked'
}

export const authService = {
  getRoleHomePath,

  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: WebConsoleUser; homePath: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message || 'Login failed')
    }
    if (!data.session) {
      throw new Error('Login failed')
    }

    try {
      const res = await api.getCurrentUser()
      const profile = res.data

      if (!isWebConsoleUser(profile)) {
        await supabase.auth.signOut()
        throw new Error('Unable to resolve user profile for this account.')
      }

      if (!isWebAllowedRole(profile.role)) {
        await supabase.auth.signOut()
        throw new Error(
          'Client and provider accounts use the mobile app only. Please sign in from the app.',
        )
      }

      return { user: profile, homePath: getRoleHomePath(profile.role) }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        await supabase.auth.signOut()
        throw new Error(
          'Your profile is incomplete. Finish registration in the mobile app, then try again.',
        )
      }
      await supabase.auth.signOut()
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e as Error)?.message
      throw new Error(msg || 'Login failed')
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  async fetchWebConsoleProfile(): Promise<WebConsoleUser | null> {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return null

    try {
      const res = await api.getCurrentUser()
      const profile = res.data
      if (!isWebConsoleUser(profile) || !isWebAllowedRole(profile.role)) {
        await supabase.auth.signOut()
        return null
      }
      return profile
    } catch {
      await supabase.auth.signOut()
      return null
    }
  },
}
