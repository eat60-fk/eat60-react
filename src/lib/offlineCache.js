const CACHE_PREFIX = 'eat60:offline:'

export function isNetworkError(error) {
  return !navigator.onLine || /failed to fetch|network|timeout|timed out|connection|fetch failed/i.test(error?.message || '')
}

export function readOfflineCache(key) {
  try {
    const value = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.warn(`Could not read cached ${key} data.`, error)
    return null
  }
}

export function writeOfflineCache(key, value) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value))
  } catch (error) {
    console.warn(`Could not save cached ${key} data.`, error)
  }
}
