// Simple test to check if server starts and responds
import fetch from 'node-fetch';

async function testServer() {
  console.log('Testing backend server...');

  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();

    console.log('✅ Server is running!');
    console.log('Health check response:', JSON.stringify(data, null, 2));

    // Test API root
    const apiResponse = await fetch('http://localhost:3001/api');
    const apiData = await apiResponse.json();
    console.log('\nAPI root response:', JSON.stringify(apiData, null, 2));

  } catch (error) {
    console.error('❌ Server is not responding:', error.message);
    console.log('\nMake sure to start the server first with: yarn dev');
  }
}

testServer();
