const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('--- DIAGNOSTIC START ---');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key length: ${supabaseKey ? supabaseKey.length : 'MISSING'}`);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing credentials.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const email = 'jay@snapwrap.com';
const password = 'PHOto!Booth$2024';

async function testLogin() {
    console.log(`\nAttempting login for: ${email}`);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('❌ Login FAILED!');
        console.error('Error Status:', error.status);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);

        if (error.message.includes('Email not confirmed')) {
            console.log('\n🚨 DIAGNOSIS: YOUR EMAIL IS NOT CONFIRMED.');
            console.log('   Go to Supabase Dashboard -> Authentication -> Users.');
            console.log('   You will see "Waiting for confirmation".');
            console.log('   Solution: Click the three dots -> "Confirm User" (if available) or disable "Confirm Email" in settings and recreate user.');
        } else if (error.message.includes('Invalid login credentials')) {
            console.log('\n🚨 DIAGNOSIS: INVALID CREDENTIALS OR UNCONFIRMED EMAIL.');
            console.log('   Supabase often returns "Invalid login credentials" for unconfirmed emails to prevent enumeration.');
            console.log('   Please check Supabase Dashboard -> Authentication -> Users to see if the user exists and is confirmed.');
        }
    } else {
        console.log('✅ Login SUCCESSFUL!');
        console.log('User ID:', data.user.id);
        console.log('Session expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
    }
}

async function attemptCreate() {
    console.log('\n--- ATTEMPTING USER CREATION ---');
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('❌ Creation Failed:', error.message);
    } else {
        console.log('✅ User Created / Magic Link Sent!');
        console.log('User ID:', data.user?.id);
        console.log('Please check your email for confirmation link if required.');
        // Verify login immediately
        await testLogin();
    }
}

// Run diagnosis
testLogin().then(async () => {
    // If login failed (we can't easily detect failure from here without return value, so let's just try create anyway if we want)
    // Actually, let's just try create if login failed.
    // However, since testLogin is async void, we can't check return value easily.
    // Let's modify testLogin to return boolean.
}).catch(console.error);

// Redefining testLogin to return boolean
async function testLoginBoolean() {
    console.log(`\nAttempting login for: ${email}`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('❌ Login FAILED:', error.message);
        return false;
    }
    console.log('✅ Login SUCCESSFUL!');
    return true;
}

// Main execution
(async () => {
    const success = await testLoginBoolean();
    if (!success) {
        await attemptCreate();
    }
    process.exit(0);
})();
