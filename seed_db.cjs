const { Client } = require('pg');

const connectionString = 'postgresql://postgres:[7772039189Aa.,]@db.ngudaxsjccdjezxyifpm.supabase.co:5432/postgres';

async function seed() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to DB!");

    // 1. Create a dummy auth user (Wait, auth.users is managed by supabase, let's just insert an os_profile with a random uuid)
    const dummyUserId = '00000000-0000-0000-0000-000000000001';
    
    // Check if profile exists
    const { rowCount } = await client.query('SELECT 1 FROM os_profiles WHERE user_id = $1', [dummyUserId]);
    if (rowCount === 0) {
      await client.query(`
        INSERT INTO os_profiles (user_id, display_name, avatar_url, cover_url)
        VALUES ($1, 'Starseed OS Admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin', null)
      `, [dummyUserId]);
      console.log("Inserted dummy profile.");
    }

    // 2. Insert a dummy preset
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
    await client.query(`
      INSERT INTO omni_presets (id, name, content, author_id, is_public, category, created_at)
      VALUES ($1, 'Resonancia Schumann (Demo)', $2, $3, true, 'resonancia', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [presetId, JSON.stringify(presetContent), dummyUserId]);
    console.log("Inserted dummy preset.");

  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await client.end();
  }
}

seed();
