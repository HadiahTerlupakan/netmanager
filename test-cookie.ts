
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import axios from 'axios'

console.log('CookieJar type:', typeof CookieJar)
console.log('CookieJar value:', CookieJar)

try {
  const jar = new CookieJar()
  console.log('CookieJar instantiated successfully')
} catch (e) {
  console.error('Error instantiating CookieJar:', e)
}
