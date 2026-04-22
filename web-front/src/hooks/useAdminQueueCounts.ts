import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'

export type AdminQueueCounts = {
  loading: boolean
  /** PENDING verification requests (all owner types) */
  pendingVerificationTotal: number
  pendingProviderVerifications: number
  pendingCompanyVerifications: number
  /** Backend endpoint not wired yet — reserved for future */
  openReclamations: number
  refresh: () => Promise<void>
}

export function useAdminQueueCounts(): AdminQueueCounts {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [pendingVerificationTotal, setPendingVerificationTotal] = useState(0)
  const [pendingProviderVerifications, setPendingProviderVerifications] =
    useState(0)
  const [pendingCompanyVerifications, setPendingCompanyVerifications] =
    useState(0)

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      setPendingVerificationTotal(0)
      setPendingProviderVerifications(0)
      setPendingCompanyVerifications(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [
        pendAll,
        reviewAll,
        pendProv,
        reviewProv,
        pendComp,
        reviewComp,
      ] = await Promise.all([
        api.listAdminVerificationRequests({ status: 'PENDING', take: 1, skip: 0 }),
        api.listAdminVerificationRequests({
          status: 'UNDER_REVIEW',
          take: 1,
          skip: 0,
        }),
        api.listAdminVerificationRequests({
          status: 'PENDING',
          ownerType: 'PROVIDER',
          take: 1,
          skip: 0,
        }),
        api.listAdminVerificationRequests({
          status: 'UNDER_REVIEW',
          ownerType: 'PROVIDER',
          take: 1,
          skip: 0,
        }),
        api.listAdminVerificationRequests({
          status: 'PENDING',
          ownerType: 'COMPANY',
          take: 1,
          skip: 0,
        }),
        api.listAdminVerificationRequests({
          status: 'UNDER_REVIEW',
          ownerType: 'COMPANY',
          take: 1,
          skip: 0,
        }),
      ])
      setPendingVerificationTotal(pendAll.data.total + reviewAll.data.total)
      setPendingProviderVerifications(pendProv.data.total + reviewProv.data.total)
      setPendingCompanyVerifications(pendComp.data.total + reviewComp.data.total)
    } catch {
      setPendingVerificationTotal(0)
      setPendingProviderVerifications(0)
      setPendingCompanyVerifications(0)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    pendingVerificationTotal,
    pendingProviderVerifications,
    pendingCompanyVerifications,
    openReclamations: 0,
    refresh,
  }
}
