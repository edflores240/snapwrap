const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local to get DATABASE_URL
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let connectionString = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
});

if (!connectionString) {
    console.error('❌ Could not find DATABASE_URL in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
});

async function confirmUser() {
    try {
        await client.connect();
        console.log('Connected to database...');

        const email = 'jay@snapwrap.com';
        console.log(`Confirming email for: ${email}`);

        const res = await client.query(
            `UPDATE auth.users SET email_confirmed_at = now() WHERE email = $1`,
            [email]
        );

        if (res.rowCount > 0) {
            console.log('✅ Success! User email marked as confirmed.');
        } else {
            console.log('⚠️ Warning: No user found with that email.');
        }

    } catch (err) {
        console.error('❌ Database error:', err);
    } finally {
        await client.end();
    }
}

confirmUser();
