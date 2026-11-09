export const SUPER_ADMIN_EMAIL = 'rjbelaire@gmail.com'

export function adminEmailsFromUsers(list = []) {
  return [...new Set(
    list
      .filter((user) => user?.role === 'admin' && user?.status !== 'disabled' && user?.email)
      .map((user) => user.email.toLowerCase()),
  )]
}

export function isAdminUser(email, users, { loaded = true } = {}) {
  if (!email) return false
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) return true
  if (!loaded) return false
  return (users || []).some((user) => (
    (user.email || '').toLowerCase() === email.toLowerCase()
    && user.role === 'admin'
    && user.status !== 'disabled'
  ))
}
