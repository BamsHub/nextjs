/**
 * Create Supabase tables by inserting dummy records which triggers auto-schema
 * OR use proper SQL via Supabase management API
 */

const SUPABASE_URL = 'https://yjdauinnnilqjfwhytis.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGF1aW5ubmlscWpmd2h5dGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjczMTEsImV4cCI6MjA4OTMwMzMxMX0.YCN-_xyGDBJ3tl-udY5d8m-thDX8BI41C344G11jvB4';

const fs = require('fs');
const path = require('path');

function readJSON(filename) {
    const p = path.join(__dirname, 'data', filename);
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return raw.items || [];
}

async function upsert(table, data) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log(`⏭️  [${table}] No data to migrate`);
        return;
    }
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KEY}`,
            'apikey': KEY,
            'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(`❌ [${table}] ${res.status}: ${text.slice(0, 300)}`);
    } else {
        console.log(`✅ [${table}] ${Array.isArray(data) ? data.length : 1} rows`);
    }
}

async function main() {
    console.log('🚀 Migrating CoffeeChain data to Supabase...\n');

    // Users
    const users = readJSON('users.json').map(u => ({
        id: u.id, name: u.name, email: u.email, password: u.password,
        role: u.role || 'farmer', region: u.region, wallet: u.wallet,
        avatar: u.avatar, bio: u.bio, location: u.location, phone: u.phone,
        language: u.language || 'Indonesia', photo_base64: u.photoBase64,
        active: u.active !== false,
        created_at: u.createdAt || new Date().toISOString(),
        last_login: u.lastLogin,
    }));
    await upsert('users', users);

    // Products
    const products = readJSON('products.json').map(p => ({
        id: p.id, name: p.name, origin: p.origin, grade: p.grade,
        variety: p.variety, roast: p.roast,
        weight: p.weight, price_per_unit: p.pricePerUnit,
        description: p.description, image: p.image, tags: p.tags,
        stock: p.stock || 0, rating: p.rating || 4.5, sold: p.sold || 0,
    }));
    await upsert('products', products);

    // Orders
    const orders = readJSON('orders.json').map(o => ({
        id: o.id, order_id: o.orderId, user_id: o.userId || 'guest',
        user_name: o.userName || 'Guest', product_id: o.productId,
        product_name: o.productName, weight: o.weight || 0,
        quantity: o.quantity || 1, total_price: o.totalPrice || 0,
        payment_method: o.paymentMethod, virtual_account: o.virtualAccount,
        tx_signature: o.txSignature, status: o.status || 'pending',
        created_at: o.createdAt, expires_at: o.expiresAt, paid_at: o.paidAt,
    }));
    await upsert('orders', orders);

    // Transactions
    const txs = readJSON('transactions.json').map(t => ({
        id: t.id, hash: t.hash, farmer: t.farmer, location: t.location,
        weight: t.weight || 0, variety: t.variety, grade: t.grade,
        amount: t.amount || 0, status: t.status || 'Pending',
        timestamp: t.timestamp, block: t.block,
        wallet_from: t.walletFrom, wallet_to: t.walletTo, note: t.note,
    }));
    await upsert('transactions', txs);

    // Farmers
    const farmers = readJSON('farmers.json').map(f => ({
        id: f.id, name: f.name, location: f.location, altitude: f.altitude,
        area: f.area, variety: f.variety, certification: f.certification,
        phone: f.phone, join_date: f.joinDate, active: f.active !== false,
        wallet: f.wallet, total_harvest: f.totalHarvest || 0, last_harvest: f.lastHarvest,
    }));
    await upsert('farmers', farmers);

    // Market prices
    const market = readJSON('market.json').map((m, i) => ({
        id: m.id || `mkt-${i+1}`,
        variety: m.variety || m.name || 'Unknown',
        price_per_kg: m.pricePerKg || m.price || 0,
        change_percent: m.changePercent || m.change || 0,
        updated_at: m.updatedAt || new Date().toISOString(),
    }));
    await upsert('market', market);

    // Markets
    const markets = readJSON('markets.json').map(m => ({
        id: m.id, name: m.name, location: m.location, type: m.type,
        contact: m.contact, capacity: m.capacity, description: m.description,
        rating: m.rating, active: m.active !== false,
    }));
    await upsert('markets', markets);

    console.log('\n✨ Migration complete!');
}

main().catch(console.error);
