export const runtime = 'nodejs';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

function farmerType(role) {
    return role === 'koperasi' ? 'Koperasi' : 'Individu';
}

async function fetchActiveFarmers() {
    const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .in('role', ['farmer', 'koperasi'])
        .eq('active', true);
    if (usersErr) throw usersErr;

    const { data: farmers, error: farmersErr } = await supabaseAdmin
        .from('farmers')
        .select('*')
        .eq('active', true);
    if (farmersErr) throw farmersErr;

    const activeFarmerIds = new Set((farmers || []).map(f => f.id));

    const { data: products, error: productsErr } = await supabaseAdmin
        .from('products')
        .select('id, name, submitted_by, rating')
        .eq('status', 'published');
    if (productsErr) throw productsErr;

    const { data: sales, error: salesErr } = await supabaseAdmin
        .from('sales')
        .select('user_id, quantity_kg, total_price')
        .eq('status', 'paid');
    if (salesErr) throw salesErr;

    const mergedFarmers = (users || [])
        .filter(user => activeFarmerIds.has(user.id))
        .map(user => {
            const farmerMeta = (farmers || []).find(f => f.id === user.id);
            const myProducts = (products || []).filter(p => p.submitted_by === user.id);

            const liveVolume = (sales || [])
                .filter(s => s.user_id === user.id)
                .reduce((sum, s) => sum + (Number(s.quantity_kg) || 0), 0);

            const liveEarnings = (sales || [])
                .filter(s => s.user_id === user.id)
                .reduce((sum, s) => sum + (Number(s.total_price) || 0), 0);

            const ratings = myProducts.map(p => Number(p.rating)).filter(n => !Number.isNaN(n));
            const avgRating = ratings.length
                ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
                : null;

            const joined = farmerMeta?.join_date
                || (user.created_at || '').split('T')[0]
                || new Date().toISOString().split('T')[0];

            return {
                id: user.id,
                name: user.name,
                type: farmerType(user.role),
                region: user.region || user.location || farmerMeta?.location || '—',
                volume: liveVolume,
                earnings: liveEarnings,
                status: user.active && farmerMeta?.active !== false ? 'Verified' : 'Pending',
                rating: avgRating,
                joined,
                wallet: user.wallet || farmerMeta?.wallet || '',
                products: myProducts.map(p => p.name),
                productCount: myProducts.length,
            };
        });

    mergedFarmers.sort((a, b) => {
        if (b.productCount !== a.productCount) return b.productCount - a.productCount;
        return b.joined.localeCompare(a.joined);
    });

    return mergedFarmers;
}

export async function GET(request) {
    try {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '')
            || new URL(request.url).searchParams.get('token');
        const session = token ? await verifyToken(token) : null;

        const mergedFarmers = await fetchActiveFarmers();

        return Response.json({
            success: true,
            data: mergedFarmers,
            _auth: session ? session.role : 'public',
        });
    } catch (e) {
        console.error('[GET /api/farmers]', e.message);
        return Response.json({ success: false, message: e.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '') || new URL(request.url).searchParams.get('token');
        const session = await verifyToken(token);
        if (!session) {
            return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        
        // Insert into users (role: farmer)
        const newUserId = `user-${uuidv4().slice(0, 8)}`;
        const { error: userErr } = await supabaseAdmin.from('users').insert({
            id: newUserId,
            name: body.name,
            email: `${body.name.toLowerCase().replace(/\s+/g, '')}@coffeechain.io`,
            password: 'password123', // placeholder
            role: body.type === 'Koperasi' ? 'koperasi' : 'farmer',
            region: body.region,
            wallet: body.wallet || '',
            active: true
        });
        if (userErr) throw userErr;

        // Insert into farmers
        const { error: farmerErr } = await supabaseAdmin.from('farmers').insert({
            id: newUserId,
            name: body.name,
            location: body.region,
            active: true,
            wallet: body.wallet || '',
            join_date: new Date().toISOString().split('T')[0]
        });
        if (farmerErr) throw farmerErr;

        return Response.json({ success: true, data: { id: newUserId, name: body.name } }, { status: 201 });
    } catch (e) {
        console.error('[POST /api/farmers]', e.message);
        return Response.json({ success: false, message: e.message }, { status: 500 });
    }
}
