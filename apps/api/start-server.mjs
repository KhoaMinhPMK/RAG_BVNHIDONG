import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🚀 Starting backend server...\n');

// Start the dev server
const serverProcess = spawn('yarn', ['dev'], {
  cwd: 'E:\\project\\webrag\\apps\\api',
  shell: true,
  stdio: 'pipe'
});

serverProcess.stdout.on('data', (data) => {
  console.log(`[SERVER] ${data.toString().trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[ERROR] ${data.toString().trim()}`);
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Wait for server to start
console.log('⏳ Waiting 8 seconds for server to initialize...\n');
await setTimeout(8000);

// Test the server
console.log('🧪 Testing server endpoints...\n');

try {
  // Test health endpoint
  const healthResponse = await fetch('http://localhost:3001/health');
  const healthData = await healthResponse.json();

  console.log('✅ Health endpoint responding:');
  console.log(JSON.stringify(healthData, null, 2));
  console.log('');

  // Test API root
  const apiResponse = await fetch('http://localhost:3001/api');
  const apiData = await apiResponse.json();

  console.log('✅ API root responding:');
  console.log(JSON.stringify(apiData, null, 2));
  console.log('');

  console.log('🎉 Backend server is running successfully on http://localhost:3001');
  console.log('');
  console.log('Server is running in the background. Press Ctrl+C to stop.');

} catch (error) {
  console.error('❌ Server test failed:', error.message);
  console.log('\n⚠️  Server may still be starting. Check manually at http://localhost:3001/health');
}

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping server...');
  serverProcess.kill();
  process.exit(0);
});
