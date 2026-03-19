
import { test, expect } from '@playwright/test';

// Script ini mensimulasikan percobaan akses IDOR pada endpoint payment
test('IDOR Protection: User should not access other site payments', async ({ request }) => {
  // Simulasi ID pembayaran yang ada di database (site berbeda)
  const paymentId = 'test-payment-id-123'; 
  
  const response = await request.get(`/api/payments/${paymentId}`, {
    headers: {
      'Authorization': 'Bearer mock-token-user-site-A', // Mock token site A
    }
  });

  // Ekspektasi: 403 Forbidden atau 404 Not Found (tergantung implementasi error handling)
  // karena paymentId milik site B sedangkan user di site A.
  expect(response.status()).toBeGreaterThanOrEqual(400);
});
