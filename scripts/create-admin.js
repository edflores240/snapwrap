const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually to avoid 'dotenv' dependency if not installed
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.argv[2] || 'admin@snapwrap.com';
const password = process.argv[3] || 'admin123';

async function createAdmin() {
    console.log(`Creating admin user: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('❌ Error creating user:', error.message);
        return;
    }

    console.log('✅ User created successfully!');
    console.log('------------------------------------------------');
    console.log('👉 If "Confirm Email" is enabled in Supabase, please check your inbox (or the Inbucket/SMTP trap if local).');
    console.log('👉 If "Confirm Email" is disabled, you can log in immediately.');
    console.log('------------------------------------------------');
    console.log('Credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

    // Verdict: Check if we can sign in
    console.log('\nVerifying login...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError) {
        console.warn('⚠️ Login verification failed:', signInError.message);
        if (signInError.message.includes('Email not confirmed')) {
            console.warn('👉 You MUST confirm your email before logging in!');
        }
    } else {
        console.log('✅ Login verification successful! You can log in now.');
    }

    process.exit(0);
}

createAdmin();
