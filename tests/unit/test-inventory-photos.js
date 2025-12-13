const API_BASE = 'http://localhost:3000'

// Test data for photo upload
const testPhotoData = {
  fotoBukti: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg'
  ],
  fotoMetadata: {
    uploadedAt: new Date().toISOString(),
    totalSize: 2048576,
    photos: [
      { name: 'photo1.jpg', size: 1024288, type: 'image/jpeg' },
      { name: 'photo2.jpg', size: 1024288, type: 'image/jpeg' }
    ]
  }
}

async function testInventoryAPIs() {
  console.log('Testing Inventory APIs with Photo Support...\n')

  // Test 1: POST /api/inventory/masuk with photos
  console.log('1. Testing POST /api/inventory/masuk with photos...')
  try {
    const masukResponse = await fetch(`${API_BASE}/api/inventory/masuk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add auth headers in a real test
        // 'Authorization': 'Bearer ***REMOVED***'
      },
      body: JSON.stringify({
        barangId: 'test-barang-id',
        gudangId: 'test-gudang-id',
        jumlah: 10,
        kondisi: 'BARU',
        keterangan: 'Test dengan foto',
        ...testPhotoData
      })
    })

    if (masukResponse.ok) {
      const result = await masukResponse.json()
      console.log('✅ Masuk API created successfully with photos')
      console.log('Response:', JSON.stringify(result, null, 2))
    } else {
      const error = await masukResponse.json()
      console.log('❌ Masuk API failed:', error)
    }
  } catch (error) {
    console.log('❌ Error testing masuk API:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 2: POST /api/inventory/keluar with photos and employee data
  console.log('2. Testing POST /api/inventory/keluar with photos and employee data...')
  try {
    const keluarResponse = await fetch(`${API_BASE}/api/inventory/keluar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add auth headers in a real test
        // 'Authorization': 'Bearer ***REMOVED***'
      },
      body: JSON.stringify({
        barangId: 'test-barang-id',
        gudangId: 'test-gudang-id',
        jumlah: 5,
        kondisi: 'BARU',
        keterangan: 'Test pengambilan dengan foto',
        employeeId: 'test-employee-id',
        purpose: 'Untuk keperluan proyek',
        ...testPhotoData
      })
    })

    if (keluarResponse.ok) {
      const result = await keluarResponse.json()
      console.log('✅ Keluar API created successfully with photos and employee data')
      console.log('Response:', JSON.stringify(result, null, 2))
    } else {
      const error = await keluarResponse.json()
      console.log('❌ Keluar API failed:', error)
    }
  } catch (error) {
    console.log('❌ Error testing keluar API:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 3: GET /api/inventory/masuk (should include photo fields)
  console.log('3. Testing GET /api/inventory/masuk (checking photo fields)...')
  try {
    const getMasukResponse = await fetch(`${API_BASE}/api/inventory/masuk?page=1&limit=5`, {
      headers: {
        // Note: You'll need to add auth headers in a real test
        // 'Authorization': 'Bearer ***REMOVED***'
      }
    })

    if (getMasukResponse.ok) {
      const result = await getMasukResponse.json()
      console.log('✅ GET Masuk API successful')

      // Check if photo fields are included
      if (result.masukList && result.masukList.length > 0) {
        const firstItem = result.masukList[0]
        console.log('Photo fields present:')
        console.log('- fotoBukti:', firstItem.fotoBukti || 'Not present')
        console.log('- fotoMetadata:', firstItem.fotoMetadata || 'Not present')
      }
    } else {
      const error = await getMasukResponse.json()
      console.log('❌ GET Masuk API failed:', error)
    }
  } catch (error) {
    console.log('❌ Error testing GET masuk API:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 4: GET /api/inventory/keluar (should include photo fields)
  console.log('4. Testing GET /api/inventory/keluar (checking photo fields)...')
  try {
    const getKeluarResponse = await fetch(`${API_BASE}/api/inventory/keluar?page=1&limit=5`, {
      headers: {
        // Note: You'll need to add auth headers in a real test
        // 'Authorization': 'Bearer ***REMOVED***'
      }
    })

    if (getKeluarResponse.ok) {
      const result = await getKeluarResponse.json()
      console.log('✅ GET Keluar API successful')

      // Check if photo and employee fields are included
      if (result.keluarList && result.keluarList.length > 0) {
        const firstItem = result.keluarList[0]
        console.log('Photo fields present:')
        console.log('- fotoBukti:', firstItem.fotoBukti || 'Not present')
        console.log('- fotoMetadata:', firstItem.fotoMetadata || 'Not present')
        console.log('Employee fields present:')
        console.log('- employeeId:', firstItem.employeeId || 'Not present')
        console.log('- purpose:', firstItem.purpose || 'Not present')
      }
    } else {
      const error = await getKeluarResponse.json()
      console.log('❌ GET Keluar API failed:', error)
    }
  } catch (error) {
    console.log('❌ Error testing GET keluar API:', error.message)
  }

  console.log('\n✨ API Testing Complete! ✨')
}

// Instructions for running this test
console.log(`
To run this test:
1. Make sure your Next.js server is running on localhost:3000
2. Add proper authentication headers (replace ***REMOVED*** with actual token)
3. Update test-barang-id and test-gudang-id with actual IDs from your database
4. Run: node test-inventory-photos.js
`)

// Uncomment the line below to run the test
// testInventoryAPIs()

module.exports = { testInventoryAPIs, testPhotoData }