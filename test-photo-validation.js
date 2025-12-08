// Validation test cases for photo upload functionality
const validationTests = [
  {
    name: 'Invalid fotoBukti type (string instead of array)',
    data: {
      barangId: 'test-barang-id',
      gudangId: 'test-gudang-id',
      jumlah: 10,
      fotoBukti: 'invalid-string' // Should be array
    },
    expectedError: 'fotoBukti harus berupa array URL foto'
  },
  {
    name: 'Invalid fotoMetadata type (string instead of object)',
    data: {
      barangId: 'test-barang-id',
      gudangId: 'test-gudang-id',
      jumlah: 10,
      fotoBukti: ['valid.jpg'],
      fotoMetadata: 'invalid-string' // Should be object
    },
    expectedError: 'fotoMetadata harus berupa object JSON'
  },
  {
    name: 'Valid photo data with empty arrays',
    data: {
      barangId: 'test-barang-id',
      gudangId: 'test-gudang-id',
      jumlah: 10,
      fotoBukti: [],
      fotoMetadata: null
    },
    expectedError: null // Should pass validation
  },
  {
    name: 'Valid photo data with photos and metadata',
    data: {
      barangId: 'test-barang-id',
      gudangId: 'test-gudang-id',
      jumlah: 10,
      fotoBukti: ['photo1.jpg', 'photo2.jpg'],
      fotoMetadata: {
        uploadedAt: new Date().toISOString(),
        totalSize: 2048576,
        photos: [
          { name: 'photo1.jpg', size: 1024288, type: 'image/jpeg' },
          { name: 'photo2.jpg', size: 1024288, type: 'image/jpeg' }
        ]
      }
    },
    expectedError: null // Should pass validation
  }
]

console.log('Photo Validation Test Cases')
console.log('===========================\n')

validationTests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`)
  console.log('Expected:', test.expectedError || 'Should pass validation')
  console.log('Data:', JSON.stringify(test.data, null, 2))
  console.log('---\n')
})

console.log(`
Manual Testing Instructions:
1. Use the test cases above to validate the API endpoints
2. For each test case, send a POST request to:
   - /api/inventory/masuk
   - /api/inventory/keluar
3. Verify that the response matches the expected behavior
4. Check that validation errors are properly returned with status 400
5. Ensure valid requests are processed successfully with status 201

Expected Behavior:
- fotoBukti should accept an array of URL strings
- fotoMetadata should accept a JSON object with photo metadata
- Both fields should be optional (null/empty should be allowed)
- Invalid types should return proper error messages
- Valid data should be stored and returned in GET responses
`)