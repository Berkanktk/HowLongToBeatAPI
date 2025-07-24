import axios from 'axios';
import { parse } from 'node-html-parser';

class HowLongToBeatScraper {
    constructor() {
        this.baseUrl = 'https://howlongtobeat.com';
        this.searchUrl = 'https://howlongtobeat.com/api/seek/6e17f7a193ef3188';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            'Referer': 'https://howlongtobeat.com/',
            'Origin': 'https://howlongtobeat.com'
        };
    }

    async searchGame(gameName) {
        try {
            const searchTerms = gameName.toLowerCase().split(' ').filter(term => term.length > 0);
            
            const requestBody = {
                searchType: "games",
                searchTerms: searchTerms,
                searchPage: 1,
                size: 20,
                searchOptions: {
                    games: {
                        userId: 0,
                        platform: "",
                        sortCategory: "popular",
                        rangeCategory: "main",
                        rangeTime: {
                            min: null,
                            max: null
                        },
                        gameplay: {
                            perspective: "",
                            flow: "",
                            genre: "",
                            difficulty: ""
                        },
                        rangeYear: {
                            min: "",
                            max: ""
                        },
                        modifier: ""
                    },
                    users: {
                        sortCategory: "postcount"
                    },
                    lists: {
                        sortCategory: "follows"
                    },
                    filter: "",
                    sort: 0,
                    randomizer: 0
                },
                useCache: true
            };

            const response = await axios.post(this.searchUrl, requestBody, {
                headers: this.headers,
                timeout: 15000
            });

            return this.parseSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error.response?.status, error.message);
            throw new Error(`Failed to search for game: ${gameName}`);
        }
    }

    parseSearchResults(data) {
        const games = [];
        
        if (data && data.data && Array.isArray(data.data)) {
            data.data.forEach(game => {
                try {
                    const gameData = this.extractGameDataFromAPI(game);
                    if (gameData) {
                        games.push(gameData);
                    }
                } catch (error) {
                    console.warn('Failed to parse game data:', error.message);
                }
            });
        }

        return games;
    }

    extractGameData(element) {
        const titleElement = element.querySelector('.search_list_details h3 a');
        if (!titleElement) return null;

        const gameId = this.extractGameId(titleElement.getAttribute('href'));
        const title = titleElement.text.trim();
        
        const imageElement = element.querySelector('.search_list_image img');
        const imageUrl = imageElement ? imageElement.getAttribute('src') : null;

        const timeElements = element.querySelectorAll('.search_list_details_block .center');
        const times = this.extractTimesFromElements(timeElements);

        return {
            id: gameId,
            title,
            imageUrl: imageUrl ? `${this.baseUrl}${imageUrl}` : null,
            times
        };
    }

    extractGameDataFromAPI(game) {
        if (!game) return null;

        const times = {
            main: this.convertSecondsToHours(game.comp_main),
            mainExtra: this.convertSecondsToHours(game.comp_plus),
            completionist: this.convertSecondsToHours(game.comp_100),
            allStyles: this.convertSecondsToHours(game.comp_all)
        };

        return {
            id: game.game_id?.toString(),
            title: game.game_name,
            imageUrl: game.game_image ? `${this.baseUrl}/games/${game.game_image}` : null,
            times,
            platforms: game.release_world ? [game.release_world] : [],
            description: game.profile_summary || null
        };
    }

    convertSecondsToHours(seconds) {
        if (!seconds || seconds <= 0) return null;
        return Math.round((seconds / 3600) * 10) / 10; // Round to 1 decimal place
    }

    extractGameId(href) {
        if (!href) return null;
        const match = href.match(/game[?]id=(\d+)/);
        return match ? match[1] : null;
    }

    extractTimesFromElements(timeElements) {
        const times = {
            main: null,
            mainExtra: null,
            completionist: null,
            allStyles: null
        };

        timeElements.forEach((element, index) => {
            const timeText = element.text.trim();
            const hours = this.parseTimeToHours(timeText);
            
            switch (index) {
                case 0:
                    times.main = hours;
                    break;
                case 1:
                    times.mainExtra = hours;
                    break;
                case 2:
                    times.completionist = hours;
                    break;
                case 3:
                    times.allStyles = hours;
                    break;
            }
        });

        return times;
    }

    parseTimeToHours(timeString) {
        if (!timeString || timeString === '--' || timeString === 'N/A') {
            return null;
        }

        const hourMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:Hours?|Hrs?|H)/i);
        if (hourMatch) {
            return parseFloat(hourMatch[1]);
        }

        const minuteMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:Minutes?|Mins?|M)/i);
        if (minuteMatch) {
            return parseFloat(minuteMatch[1]) / 60;
        }

        const hoursMinutesMatch = timeString.match(/(\d+)h?\s*(\d+)m?/i);
        if (hoursMinutesMatch) {
            const hours = parseInt(hoursMinutesMatch[1]);
            const minutes = parseInt(hoursMinutesMatch[2]);
            return hours + (minutes / 60);
        }

        return null;
    }

    async getGameDetails(gameId) {
        try {
            const gameUrl = `${this.baseUrl}/game?id=${gameId}`;
            const response = await axios.get(gameUrl, {
                headers: {
                    'User-Agent': this.headers['User-Agent']
                },
                timeout: 10000
            });

            return this.parseGameDetails(response.data, gameId);
        } catch (error) {
            console.error('Failed to get game details:', error.message);
            throw new Error(`Failed to get details for game ID: ${gameId}`);
        }
    }

    parseGameDetails(html, gameId) {
        const root = parse(html);
        
        const titleElement = root.querySelector('.profile_header');
        const title = titleElement ? titleElement.text.trim() : null;

        const imageElement = root.querySelector('.game_image img');
        const imageUrl = imageElement ? imageElement.getAttribute('src') : null;

        const timeElements = root.querySelectorAll('.game_times li');
        const times = this.extractDetailedTimes(timeElements);

        const descriptionElement = root.querySelector('.in.back_primary p');
        const description = descriptionElement ? descriptionElement.text.trim() : null;

        const platformElements = root.querySelectorAll('.profile_info strong');
        const platforms = [];
        platformElements.forEach(el => {
            const text = el.text.trim();
            if (text && !text.includes('Hours') && !text.includes('Rating')) {
                platforms.push(text);
            }
        });

        return {
            id: gameId,
            title,
            description,
            imageUrl: imageUrl ? `${this.baseUrl}${imageUrl}` : null,
            platforms,
            times
        };
    }

    extractDetailedTimes(timeElements) {
        const times = {
            main: null,
            mainExtra: null,
            completionist: null,
            allStyles: null
        };

        timeElements.forEach(element => {
            const labelElement = element.querySelector('h5');
            const timeElement = element.querySelector('.time_100');
            
            if (!labelElement || !timeElement) return;

            const label = labelElement.text.trim().toLowerCase();
            const timeText = timeElement.text.trim();
            const hours = this.parseTimeToHours(timeText);

            if (label.includes('main story')) {
                times.main = hours;
            } else if (label.includes('main + extras')) {
                times.mainExtra = hours;
            } else if (label.includes('completionist')) {
                times.completionist = hours;
            } else if (label.includes('all styles')) {
                times.allStyles = hours;
            }
        });

        return times;
    }
}

export default HowLongToBeatScraper;