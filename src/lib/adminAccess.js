export function resolveAdminAccess({ data, error }) {
  if (error) {
    return { status: 'error', message: error.message || 'Could not verify administrator access.' }
  }
  return { status: data === true ? 'allowed' : 'denied' }
}
