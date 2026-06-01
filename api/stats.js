const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const OBJECTS     = ['resume','arcade','bookshelf','telephone','sofa','clock','door','assistant'];
const PAGES       = ['/home','/resume','/projects','/casestudies','/connect','/dashboard'];
const CHARACTERS  = ['spider','wonder','hulk'];
const EVENT_TYPES = ['page_view','room_enter','object_interact','baymax_ask','character_switch'];
const CACHE_TTL   = 30; // seconds

function last14Days() {
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).end();

    // Return cached response if fresh
    const cached = await redis.get('pa:stats:cache');
    if (cached) return res.status(200).json(cached);

    const days = last14Days();
    const pipe = redis.pipeline();

    // Totals
    EVENT_TYPES.forEach(t  => pipe.get(`pa:total:${t}`));
    // Daily counts for each type
    days.forEach(d => EVENT_TYPES.forEach(t => pipe.get(`pa:day:${d}:${t}`)));
    // Daily visitors
    days.forEach(d => pipe.pfcount(`pa:day:${d}:visitors`));
    // Object counts
    OBJECTS.forEach(o    => pipe.get(`pa:obj:${o}`));
    // Page counts
    PAGES.forEach(p      => pipe.get(`pa:page:${p}`));
    // Character counts
    CHARACTERS.forEach(c => pipe.get(`pa:char:${c}`));
    // Total visitors
    pipe.pfcount('pa:visitors');

    const results = await pipe.exec();
    let i = 0;

    const totals = {};
    EVENT_TYPES.forEach(t => { totals[t] = Number(results[i++] || 0); });

    const daily = days.map(date => {
        const entry = { date };
        EVENT_TYPES.forEach(t => { entry[t] = Number(results[i++] || 0); });
        return entry;
    });

    const dailyVisitors = days.map(date => ({ date, visitors: Number(results[i++] || 0) }));
    daily.forEach((d, idx) => { d.visitors = dailyVisitors[idx].visitors; });

    const objects = OBJECTS.map(id => ({ id, count: Number(results[i++] || 0) }))
        .sort((a, b) => b.count - a.count);

    const pages = PAGES.map(path => ({ path, count: Number(results[i++] || 0) }))
        .sort((a, b) => b.count - a.count);

    const characters = CHARACTERS.map(name => ({ name, count: Number(results[i++] || 0) }))
        .sort((a, b) => b.count - a.count);

    const visitors_approx = Number(results[i++] || 0);

    const payload = {
        updated_at: new Date().toISOString(),
        totals,
        visitors_approx,
        objects,
        pages,
        characters,
        daily,
    };

    // Cache for 30s
    await redis.set('pa:stats:cache', payload, { ex: CACHE_TTL });

    return res.status(200).json(payload);
};
