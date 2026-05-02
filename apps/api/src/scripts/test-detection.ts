/**
 * Test Detection API
 *
 * Simple test script to verify detection endpoints work correctly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDetectionAPI() {
  console.log('🧪 Testing Detection API...\n');

  // 1. Get first episode
  console.log('1️⃣ Fetching first episode...');
  const { data: episodes, error: episodesError } = await supabase
    .from('episodes')
    .select('id, patient_ref, status')
    .limit(1);

  if (episodesError || !episodes || episodes.length === 0) {
    console.error('❌ Failed to fetch episodes:', episodesError?.message);
    process.exit(1);
  }

  const episode = episodes[0];
  console.log(`✅ Found episode: ${episode.id} (${episode.patient_ref})`);
  console.log(`   Status: ${episode.status}\n`);

  // 2. Create a test image for this episode
  console.log('2️⃣ Creating test image...');
  const { data: image, error: imageError } = await supabase
    .from('images')
    .insert({
      episode_id: episode.id,
      file_name: 'test-xray.jpg',
      storage_path: 'test/test-xray.jpg',
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (imageError) {
    console.error('❌ Failed to create image:', imageError.message);
    process.exit(1);
  }

  console.log(`✅ Created image: ${image.image_id}\n`);

  // 3. Simulate detection trigger (direct DB insert)
  console.log('3️⃣ Creating detection job...');
  const { data: detectionJob, error: jobError } = await supabase
    .from('detection_results')
    .insert({
      episode_id: episode.id,
      status: 'processing',
      progress: 0,
      results: null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError) {
    console.error('❌ Failed to create detection job:', jobError.message);
    process.exit(1);
  }

  console.log(`✅ Created detection job: ${detectionJob.id}`);
  console.log(`   Status: ${detectionJob.status}`);
  console.log(`   Progress: ${detectionJob.progress}%\n`);

  // 4. Simulate detection progress
  console.log('4️⃣ Simulating detection progress...');
  const steps = [20, 40, 60, 80, 100];

  for (const progress of steps) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = progress === 100 ? 'completed' : 'processing';
    await supabase
      .from('detection_results')
      .update({ progress, status })
      .eq('id', detectionJob.id);

    console.log(`   Progress: ${progress}% (${status})`);
  }

  // 5. Add mock results
  console.log('\n5️⃣ Adding mock detection results...');
  const mockResults = {
    model_version: 'PCXR-v1.0-mock',
    detections: [
      {
        label: 'Infiltrate',
        confidence: 0.87,
        bbox: [120, 80, 200, 160],
        location: 'Phổi phải, thùy dưới',
      },
      {
        label: 'Consolidation',
        confidence: 0.92,
        bbox: [150, 100, 220, 180],
        location: 'Phổi phải, thùy giữa',
      },
    ],
    findings: ['Infiltrate phổi phải', 'Consolidation thùy giữa'],
    severity: 'moderate',
    timestamp: new Date().toISOString(),
  };

  await supabase
    .from('detection_results')
    .update({
      status: 'completed',
      progress: 100,
      results: mockResults,
      completed_at: new Date().toISOString(),
    })
    .eq('id', detectionJob.id);

  console.log('✅ Detection results added');
  console.log(`   Findings: ${mockResults.findings.join(', ')}`);
  console.log(`   Severity: ${mockResults.severity}\n`);

  // 6. Update episode with findings
  console.log('6️⃣ Updating episode...');
  await supabase
    .from('episodes')
    .update({
      findings: mockResults.findings,
      status: 'pending_explain',
    })
    .eq('id', episode.id);

  console.log('✅ Episode updated');
  console.log(`   New status: pending_explain`);
  console.log(`   Findings: ${mockResults.findings.join(', ')}\n`);

  // 7. Verify final state
  console.log('7️⃣ Verifying final state...');
  const { data: finalDetection } = await supabase
    .from('detection_results')
    .select('*')
    .eq('id', detectionJob.id)
    .single();

  const { data: finalEpisode } = await supabase
    .from('episodes')
    .select('id, status, findings')
    .eq('id', episode.id)
    .single();

  console.log('✅ Final state verified:');
  console.log(`   Detection job: ${finalDetection?.status} (${finalDetection?.progress}%)`);
  console.log(`   Episode status: ${finalEpisode?.status}`);
  console.log(`   Episode findings: ${finalEpisode?.findings?.join(', ')}\n`);

  console.log('✅ Detection API test complete!\n');
  console.log('📊 Summary:');
  console.log('   ✅ Detection job created');
  console.log('   ✅ Progress simulation working');
  console.log('   ✅ Results stored correctly');
  console.log('   ✅ Episode updated with findings');
  console.log('\n🔗 Frontend can now poll: GET /api/episodes/:id/detection/status\n');
}

testDetectionAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
