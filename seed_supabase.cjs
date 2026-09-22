const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ngudaxsjccdjezxyifpm.supabase.co',
  'sb_publishable_UQAVJpOGr0HCQU2NMU7Z8Q_TsHIuNFL'
);

async function seed() {
  const dummyUserId = '00000000-0000-0000-0000-000000000001';

  // 1. Insert Profile
  const { error: pError } = await supabase.from('os_profiles').upsert({
    user_id: dummyUserId,
    display_name: 'Starseed OS Admin',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
  });
  if (pError) console.error("Profile Error:", pError);
  else console.log("Profile inserted!");

  // 2. Insert Preset
  const presetContent = {
    description: 'Una frecuencia base de demostración (Schumann) para la comunidad.',
    tags: ['demo', 'schumann', 'tierra'],
    category: 'resonancia',
    oscillators: [
      {
        id: 'osc-demo-1',
        type: 'sine',
        frequency: 7.83,
        volume: 0.5,
        pan: 0,
        isActive: true
      }
    ]
  };

  const presetId = 'preset-demo-123';
  const { error: prError } = await supabase.from('omni_presets').upsert({
    id: presetId,
    name: 'Resonancia Schumann (Demo)',
    content: presetContent,
    author_id: dummyUserId,
    is_public: true,
    category: 'resonancia'
  });

  if (prError) console.error("Preset Error:", prError);
  else console.log("Preset inserted!");
}

seed();
