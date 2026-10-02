import test from 'node:test'
import assert from 'node:assert/strict'
import { CUSTOMER_TAB_PATHS, pathForMorePage, resolveCustomerRoute } from '../src/lib/customerRoutes.js'

test('customer screens resolve from their public route paths', () => {
  assert.deepEqual(resolveCustomerRoute('/wallet'), { tab: 'wallet' })
  assert.deepEqual(resolveCustomerRoute('/order-history'), { tab: 'hist' })
  assert.deepEqual(resolveCustomerRoute('/games'), { tab: 'games', gameView: 'games' })
  assert.deepEqual(resolveCustomerRoute('/leaderboard'), { tab: 'games', gameView: 'rankings' })
  assert.deepEqual(resolveCustomerRoute('/order'), { tab: 'home' })
  assert.deepEqual(resolveCustomerRoute('/cart'), { tab: 'cart' })
  assert.deepEqual(resolveCustomerRoute('/profile'), { tab: 'more', morePage: 'profile' })
  assert.deepEqual(resolveCustomerRoute('/about'), { tab: 'more', morePage: 'about' })
  assert.deepEqual(resolveCustomerRoute('/refer'), { tab: 'more', morePage: 'refer' })
  assert.deepEqual(resolveCustomerRoute('/careers'), { tab: 'more', morePage: 'careers' })
  assert.deepEqual(resolveCustomerRoute('/setting'), { tab: 'more' })
})

test('customer routes accept trailing slashes and legacy aliases', () => {
  assert.deepEqual(resolveCustomerRoute('/wallet/'), { tab: 'wallet' })
  assert.deepEqual(resolveCustomerRoute('/orders'), { tab: 'hist' })
  assert.deepEqual(resolveCustomerRoute('/feed'), { tab: 'feed' })
  assert.deepEqual(resolveCustomerRoute('/settings'), { tab: 'more' })
})

test('navigation destinations map to stable route paths', () => {
  assert.equal(CUSTOMER_TAB_PATHS.wallet, '/wallet')
  assert.equal(CUSTOMER_TAB_PATHS.hist, '/order-history')
  assert.equal(CUSTOMER_TAB_PATHS.cart, '/cart')
  assert.equal(pathForMorePage('profile'), '/profile')
  assert.equal(pathForMorePage('support'), '/support')
  assert.equal(pathForMorePage('about'), '/about')
  assert.equal(pathForMorePage('refer'), '/refer')
  assert.equal(pathForMorePage('careers'), '/careers')
  assert.equal(pathForMorePage(null), '/setting')
})
