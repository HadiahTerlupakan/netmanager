// Public API for Events Module

// BillingEventDispatcher is the sole public API of this module.
// It provides cross-module event hooks that other modules can call
// when billing-relevant events occur (e.g., customer created, invoice paid).
export { BillingEventDispatcher } from './BillingEventDispatcher'
