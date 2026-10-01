import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAdminAccess } from '../src/lib/adminAccess.js'

test('allows only an explicit true administrator result', () => {
  assert.deepEqual(resolveAdminAccess({ data: true, error: null }), { status: 'allowed' })
  assert.deepEqual(resolveAdminAccess({ data: false, error: null }), { status: 'denied' })
  assert.deepEqual(resolveAdminAccess({ data: null, error: null }), { status: 'denied' })
})

test('fails closed and preserves the database error', () => {
  assert.deepEqual(resolveAdminAccess({ data: true, error: { message: 'RPC unavailable' } }), {
    status: 'error',
    message: 'RPC unavailable'
  })
  assert.deepEqual(resolveAdminAccess({ data: null, error: {} }), {
    status: 'error',
    message: 'Could not verify administrator access.'
  })
})
