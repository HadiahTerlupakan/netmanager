/** Model yang tidak diisolasi per tenant oleh `withTenantIsolation`. */
export const ignoreModels = [
  "Account",
  "Session",
  "VerificationToken",
  "Tenant",
  "SystemLog",
  "JournalLine",
  "BankReconciliationLine",
  "OvertimeAutoCheckoutSchedule",
  "PlayStoreRelease",
  "UploadSyncPending",
  "LandingHero",
  "LandingFeature",
  "LandingPricing",
  "LandingTestimonial",
  "LandingFaq",
  "LandingFooter",
  // Tanpa kolom tenantId. Akses dari rute tenant selalu lewat induk yang sudah
  // difilter tenant (TenantVpnServer / MikroTikRouter); sisanya hanya rute admin.
  "VpnServer",
  "MikroTikRouterVpnServer",
  "VpnCoreRouterTombstone",
];
