const { Receiver } = require('@upstash/qstash');
const { Redis } = require('@upstash/redis');

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY,
});
const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    // Verify QStash signature
    try {
        const signature = req.headers['upstash-signature'];
        const body = JSON.stringify(req.body);
        const isValid = await receiver.verify({ body, signature });
        if (!isValid) return res.status(401).end();
    } catch {
        return res.status(401).end();
    }

    const event = req.body;
    if (!event?.type) return res.status(200).end();

    const d = today();
    const pipe = redis.pipeline();

    // All-time total per event type
    pipe.incr(`pa:total:${event.type}`);
    // Daily count per event type (expire after 90 days)
    pipe.incr(`pa:day:${d}:${event.type}`);
    pipe.expire(`pa:day:${d}:${event.type}`, 60 * 60 * 24 * 90);

    // Event-specific counters
    if (event.type === 'object_interact' && event.props?.object) {
        pipe.incr(`pa:obj:${event.props.object}`);
    }
    if (event.type === 'page_view' && event.props?.path) {
        pipe.incr(`pa:page:${event.props.path}`);
    }
    if (event.type === 'character_switch' && event.props?.character) {
        pipe.incr(`pa:char:${event.props.character}`);
    }

    // Approximate unique visitors via HyperLogLog
    if (event.vid && event.vid !== 'unknown') {
        pipe.pfadd('pa:visitors', event.vid);
        pipe.pfadd(`pa:day:${d}:visitors`, event.vid);
        pipe.expire(`pa:day:${d}:visitors`, 60 * 60 * 24 * 90);
    }

    // Invalidate stats cache so next GET /api/stats is fresh
    pipe.del('pa:stats:cache');

    try {
        await pipe.exec();
    } catch (err) {
        console.error('Redis pipeline error:', err?.message);
    }

    return res.status(200).end();
};
