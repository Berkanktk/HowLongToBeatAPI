import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import HowLongToBeatAPI from './hltb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const hltb = new HowLongToBeatAPI();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(type, query) {
    return `${type}:${query.toLowerCase()}`;
}

function isValidCache(timestamp) {
    return Date.now() - timestamp < CACHE_TTL;
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'HowLongToBeat API',
        version: '1.0.0',
        endpoints: {
            search: '/api/search?q={game_name}',
            game: '/api/game/{game_id}',
            health: '/api/health'
        },
        description: 'Unofficial API for HowLongToBeat game completion times'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache_size: cache.size
    });
});

// Search endpoint for lookups on the HowLongToBeat website.
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({
                error: 'Missing required parameter: q (game name)'
            });
        }

        if (query.length < 2) {
            return res.status(400).json({
                error: 'Search query must be at least 2 characters long'
            });
        }

        const cacheKey = getCacheKey('search', query);
        const cached = cache.get(cacheKey);
        
        if (cached && isValidCache(cached.timestamp)) {
            return res.json({
                query,
                results: cached.data,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        const results = await hltb.searchGame(query);
        
        cache.set(cacheKey, {
            data: results,
            timestamp: Date.now()
        });

        res.json({
            query,
            results,
            cached: false,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Failed to search games',
            message: error.message
        });
    }
});

// Game details endpoint for lookups on the HowLongToBeat website.
app.get('/api/game/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        
        if (!gameId || !/^\d+$/.test(gameId)) {
            return res.status(400).json({
                error: 'Invalid game ID. Must be a numeric value.'
            });
        }

        const cacheKey = getCacheKey('game', gameId);
        const cached = cache.get(cacheKey);
        
        if (cached && isValidCache(cached.timestamp)) {
            return res.json({
                game: cached.data,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`Getting details for game ID: ${gameId}`);
        const gameDetails = await hltb.getGameDetails(gameId);
        
        cache.set(cacheKey, {
            data: gameDetails,
            timestamp: Date.now()
        });

        res.json({
            game: gameDetails,
            cached: false,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Game details error:', error);
        res.status(500).json({
            error: 'Failed to get game details',
            message: error.message
        });
    }
});

// Steam games endpoint for fetching owned games from the Steam API.
app.get('/api/steam/games', async (req, res) => {
    try {
        const { steamid, key } = req.query;
        
        if (!steamid || !key) {
            return res.status(400).json({
                error: 'Missing required parameters: steamid and key'
            });
        }

        const steamApiUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamid}&format=json&include_appinfo=1&include_played_free_games=1`;
        
        const response = await fetch(steamApiUrl);
        
        if (!response.ok) {
            throw new Error(`Steam API error: ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Steam API proxy error:', error);
        res.status(500).json({
            error: 'Failed to fetch Steam games',
            message: error.message
        });
    }
});

// Error handling for endpoints that are not found.
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: [
            '/api/search?q={game_name}',
            '/api/game/{game_id}',
            '/api/health'
        ]
    });
});

// Error handling for unhandled errors.
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Start the server.
app.listen(port, () => {
    console.log(`HowLongToBeat API server running on port ${port}`);
    console.log(`Available endpoints:`);
    console.log(`  GET  /api/search?q={game_name}`);
    console.log(`  GET  /api/game/{game_id}`);
    console.log(`  GET  /api/health`);
});

export default app;