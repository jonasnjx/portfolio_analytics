const { Client } = require('@upstash/qstash');
const { Redis } = require('@upstash/redis');
const { Ratelimit } = require('@upstash/ratelimit');
const { createHash } = require('crypto');
const { validate } = require('../lib/schema');

const qstash = new Client({ token: process.env.QSTASH_TOKEN });
const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
});

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    // Rate limit by hashed IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';
    const ipHash = createHash('sha256').update(ip + process.env.IP_SALT || 'salt').digest('hex').slice(0, 16);
    try {
        const { success } = await ratelimit.limit(ipHash);
        if (!success) return res.status(204).end(); // silent drop
    } catch { /* continue if ratelimit fails */ }

    const event = validate(req.body);
    if (!event) return res.status(204).end(); // silent drop on invalid

    try {
        await qstash.publishJSON({
            url: process.env.CONSUME_URL, // e.g. https://portfolio-analytics.vercel.app/api/consume
            body: event,
        });
    } catch (err) {
        console.error('QStash publish error:', err?.message);
    }

    return res.status(204).end();
};
