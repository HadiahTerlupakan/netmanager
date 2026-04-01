// Presentation Routes - Clean Architecture
// These routes use use cases instead of services directly.
// They coexist with the existing routes at app/api/attendance/*.
export { POST as checkIn } from './check-in/route'
export { POST as checkOut } from './check-out/route'
export { GET as getStatus } from './status/route'
