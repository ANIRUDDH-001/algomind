const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const envData = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
    envData.split('\n')
        .filter(l => l && !l.startsWith('#'))
        .map(l => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim()];
        })
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const email = 'anirudhvijay001@gmail.com';
    console.log('Checking user:', email);

    const { data: profile, error } = await supabase
        .from('learner_profiles')
        .select('user_id, email, role')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Profile fetch error:', error);
    } else {
        console.log('Profile Role Data:', profile);
    }
}

check();
