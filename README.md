# HowLongToBeat API

An API for getting game completion times from HowLongToBeat .

## Features

- **Game Search**: Search for games by name
- **Game Details**: Get detailed completion times for specific games
- **Multiple Time Categories**: Main story, Main + Extras, Completionist, and All Styles

## Installation

```bash
npm install
```

## Usage

### Start the server

```bash
npm start
```

### Development mode (with auto-restart)

```bash
npm run dev
```

### Run tests

```bash
npm test
```

## API Endpoints

### Search Games

```
GET /api/search?q={game_name}
```

**Parameters:**
- `q` (required): Game name to search for (minimum 2 characters)

**Example:**
```bash
curl "http://localhost:3000/api/search?q=witcher"
```

**Response:**
```json
{
  "query": "witcher",
  "results": [
    {
      "id": "10270",
      "title": "The Witcher 3: Wild Hunt",
      "imageUrl": "https://howlongtobeat.com/games/witcher3_header.jpg",
      "times": {
        "main": 51.5,
        "mainExtra": 103,
        "completionist": 173,
        "allStyles": 104
      },
      "platforms": ["PC", "PlayStation 4", "Xbox One", "Nintendo Switch"],
      "description": "As war rages on throughout the Northern Realms..."
    }
  ],
  "cached": false,
  "timestamp": "2025-07-23T19:42:13.689Z"
}
```

### Get Game Details

```
GET /api/game/{game_id}
```

**Parameters:**
- `game_id` (required): Numeric game ID from search results

**Example:**
```bash
curl "http://localhost:3000/api/game/10270"
```

**Response:**
```json
{
  "game": {
    "id": "10270",
    "title": "The Witcher 3: Wild Hunt",
    "imageUrl": "https://howlongtobeat.com/games/witcher3_header.jpg",
    "times": {
      "main": 51.5,
      "mainExtra": 103,
      "completionist": 173,
      "allStyles": 104
    },
    "platforms": ["PC", "PlayStation 4", "Xbox One", "Nintendo Switch"],
    "description": "As war rages on throughout the Northern Realms..."
  },
  "cached": false,
  "timestamp": "2025-07-23T19:42:22.554Z"
}
```

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-23T19:42:30.917Z",
  "cache_size": 2
}
```

## Time Categories

- **main**: Time to complete main story only
- **mainExtra**: Main story + side quests and extras
- **completionist**: 100% completion (all content)
- **allStyles**: Average across all play styles

Times are returned in hours as decimal numbers (e.g., 51.5 = 51 hours 30 minutes).

## Frontend Interface

The project includes a web frontend that fetches Steam games and displays their HowLongToBeat completion times.

### Access the Frontend

1. Start the server: `npm start`
2. Open your browser to: `http://localhost:3000/` (requires Steam API key & Steam ID)

### Frontend Features

- **Batch Processing**: Fetches beat times for all games in batches of 50
- **Smart Matching**: Matches Steam game names with HowLongToBeat database
- **Error Handling**: Graceful handling of API failures and missing data
- **Progress Tracking**: Shows loading progress for beat time fetches

## Development

The project structure:

```
src/
├── index.js        # Express server and API routes
├── htlb.js      # HowLongToBeat API

public/
├── index.html      # Main frontend interface
├── app.js          # Frontend JavaScript (Steam integration)
└── styles.css      # Responsive CSS styling
```