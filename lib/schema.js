const VALID_TYPES = new Set([
    'page_view', 'room_enter', 'object_interact', 'baymax_ask', 'character_switch'
]);

const VALID_OBJECTS = new Set([
    'resume', 'arcade', 'bookshelf', 'telephone', 'sofa', 'clock', 'door', 'assistant'
]);

const VALID_PATHS = new Set([
    '/', '/home', '/resume', '/projects', '/casestudies', '/connect', '/dashboard',
    '/casestudies/context-engineering-2026', '/casestudies/baymax-ai-assistant-2026',
    '/casestudies/data-ai-2025'
]);

const VALID_CHARACTERS = new Set(['spider', 'wonder', 'hulk']);

const VALID_SOURCES = new Set(['room', 'widget']);

function validate(event) {
    if (!event || typeof event !== 'object') return null;
    const { type, props = {}, vid, ua } = event;

    if (!VALID_TYPES.has(type)) return null;

    const clean = {
        type,
        ts: Date.now(),
        vid: typeof vid === 'string' ? vid.slice(0, 16) : 'unknown',
        ua: ua === 'mobile' ? 'mobile' : 'desktop',
        props: {},
    };

    if (type === 'object_interact' && VALID_OBJECTS.has(props.object)) {
        clean.props.object = props.object;
    }
    if (type === 'page_view' && VALID_PATHS.has(props.path)) {
        clean.props.path = props.path;
    }
    if (type === 'baymax_ask') {
        clean.props.source = VALID_SOURCES.has(props.source) ? props.source : 'unknown';
    }
    if (type === 'character_switch' && VALID_CHARACTERS.has(props.character)) {
        clean.props.character = props.character;
    }

    return clean;
}

module.exports = { validate };
