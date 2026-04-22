import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/authStore'

export function useAuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser)
  const setAuthReady = useAuthStore((s) => s.setAuthReady)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const user = await authService.fetchWebConsoleProfile()
      if (!cancelled) {
        setUser(user)
        setAuthReady(true)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [setAuthReady, setUser])
}
