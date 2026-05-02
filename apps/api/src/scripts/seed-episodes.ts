/**
 * Database Seeding Script - Test Episodes
 *
 * Creates 10 test episodes with realistic pediatric pneumonia data
 * for frontend integration testing.
 *
 * Usage: npm run seed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get test user ID from profiles table
async function getTestUserId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', 'clinician@bvnhidong.vn')
    .single();

  if (error || !data) {
    console.error('❌ Failed to get test user ID:', error?.message);
    console.log('💡 Using fallback: creating episodes without user reference');
    // Return a valid UUID format as fallback
    return '00000000-0000-0000-0000-000000000000';
  }

  return data.user_id;
}

// Realistic pediatric data
const PATIENT_NAMES = [
  'Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E',
  'Vũ Thị F', 'Đặng Văn G', 'Bùi Thị H', 'Đỗ Văn I', 'Ngô Thị K'
];

const SYMPTOMS = [
  'Ho khan, sốt 38.5°C, khó thở nhẹ',
  'Ho có đờm, sốt cao 39°C, thở nhanh',
  'Ho nhiều, sốt 38°C, mệt mỏi',
  'Ho, sốt 39.5°C, khó thở, rút lõm lồng ngực',
  'Ho, sốt nhẹ 37.8°C, ăn kém',
  'Ho có đờm vàng, sốt 38.2°C, thở khò khè',
  'Ho khan, sốt 39°C, đau ngực khi thở',
  'Ho, sốt 38.5°C, mệt, chán ăn',
  'Ho nhiều ban đêm, sốt 38°C',
  'Ho, sốt cao 39.2°C, thở nhanh, li bì'
];

const FINDINGS_BY_STATUS = {
  pending_detection: [],
  pending_explain: [
    ['Infiltrate phổi phải', 'Tăng âm phế nang'],
    ['Consolidation thùy dưới trái', 'Silhouette sign dương']
  ],
  pending_draft: [
    ['Infiltrate lan tỏa hai phổi', 'Tăng âm phế nang', 'Dày thành phế quản'],
    ['Consolidation thùy giữa phải', 'Air bronchogram', 'Tràn dịch màng phổi nhẹ']
  ],
  pending_approval: [
    ['Viêm phổi thùy dưới phải', 'Consolidation', 'Tràn dịch màng phổi'],
    ['Viêm phổi kẽ hai bên', 'Infiltrate lan tỏa', 'Tăng âm phế nang']
  ],
  completed: [
    ['Viêm phổi thùy dưới trái', 'Consolidation', 'Đã điều trị ổn định'],
    ['Viêm phổi kẽ', 'Infiltrate hai phổi', 'Đã hồi phục']
  ]
};

interface EpisodeData {
  patient_id: string;
  patient_ref: string;
  age: string;
  gender: string;
  admission_date: string;
  chief_complaint: string;
  vital_signs: {
    spo2: string;
    heart_rate: string;
    respiratory_rate: string;
    temperature: string;
  };
  lab_results: {
    crp: string;
    wbc: string;
  };
  status: string;
  findings: string[];
  created_by: string;
}

async function seedEpisodes() {
  console.log('🌱 Starting database seeding...\n');

  // Get test user ID
  const testUserId = await getTestUserId();
  console.log(`👤 Using user ID: ${testUserId}\n`);

  const statuses = [
    'pending_detection',
    'pending_detection',
    'pending_explain',
    'pending_explain',
    'pending_draft',
    'pending_draft',
    'pending_approval',
    'pending_approval',
    'completed',
    'completed'
  ];

  const episodes: EpisodeData[] = [];

  for (let i = 0; i < 10; i++) {
    const status = statuses[i];
    const patientRef = `BN${String(i + 1).padStart(4, '0')}`;
    const age = Math.floor(Math.random() * 10) + 2; // 2-12 tuổi
    const gender = i % 2 === 0 ? 'Nam' : 'Nữ';

    // Generate admission date (last 7 days)
    const daysAgo = Math.floor(Math.random() * 7);
    const admissionDate = new Date();
    admissionDate.setDate(admissionDate.getDate() - daysAgo);

    // Get findings based on status
    const findingsArray = FINDINGS_BY_STATUS[status as keyof typeof FINDINGS_BY_STATUS];
    const findings = findingsArray[Math.floor(Math.random() * findingsArray.length)] || [];

    const episode: EpisodeData = {
      patient_id: patientRef,
      patient_ref: patientRef,
      age: `${age} tuổi`,
      gender,
      admission_date: admissionDate.toISOString(),
      chief_complaint: SYMPTOMS[i],
      vital_signs: {
        spo2: `${92 + Math.floor(Math.random() * 6)}%`, // 92-97%
        heart_rate: `${100 + Math.floor(Math.random() * 40)} bpm`, // 100-140 bpm
        respiratory_rate: `${30 + Math.floor(Math.random() * 20)} lần/phút`, // 30-50
        temperature: `${37.5 + Math.random() * 2}°C` // 37.5-39.5°C
      },
      lab_results: {
        crp: `${10 + Math.floor(Math.random() * 90)} mg/L`, // 10-100 mg/L
        wbc: `${8 + Math.floor(Math.random() * 12)} x10^9/L` // 8-20
      },
      status,
      findings,
      created_by: testUserId
    };

    episodes.push(episode);
  }

  // Insert episodes
  console.log('📝 Inserting episodes...');
  const { data, error } = await supabase
    .from('episodes')
    .insert(episodes)
    .select();

  if (error) {
    console.error('❌ Failed to insert episodes:', error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${data?.length || 0} episodes\n`);

  // Print summary
  console.log('📊 Summary:');
  const statusCounts = statuses.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} episodes`);
  });

  console.log('\n✅ Database seeding complete!');
  console.log('🔗 Frontend can now fetch episodes from GET /api/episodes\n');
}

// Run seeding
seedEpisodes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
