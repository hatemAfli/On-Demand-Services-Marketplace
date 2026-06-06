const BRANCH_STORAGE_KEY = 'company-admin-selected-branch-id'

export function getStoredBranchId(): string | null {
  try {
    return localStorage.getItem(BRANCH_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredBranchId(branchId: string): void {
  try {
    localStorage.setItem(BRANCH_STORAGE_KEY, branchId)
  } catch {
    /* ignore */
  }
}

export function clearStoredBranchId(): void {
  try {
    localStorage.removeItem(BRANCH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
