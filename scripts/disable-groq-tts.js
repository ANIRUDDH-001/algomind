import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('global_feature_flags')
        .update({ is_enabled: false })
        .eq('key', 'ENABLE_GROQ_TTS');

    if (error) {
        console.error("Error updating flag:", error);
        process.exit(1);
    }

    console.log("Successfully disabled ENABLE_GROQ_TTS in DB");
}
main();
