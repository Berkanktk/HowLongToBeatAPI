class SteamGameBeatTimes {
    constructor() {
        this.games = [];
        this.filteredGames = [];
        this.sortOrder = 'asc';
        this.sortBy = 'name';
        this.loadingCount = 0;
        this.totalGamesToFetch = 0;
        this.gamesFetched = 0;
        this.beatTimesCache = this.loadBeatTimesCache();
        this.customBeatTimes = this.loadCustomBeatTimes();
        this.steamGamesCache = this.loadSteamGamesCache();
        this.gameCollection = this.loadGameCollection();
        this.fetchMode = 'games-beattimes';
        this.currentStep = 1; // 1: Data Source, 2: Review Results, 3: Manage Collection
        this.hidePlayedGames = false;
        this.dataCollectionComplete = false;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('fetchGames').addEventListener('click', () => this.fetchSteamGames());
        document.getElementById('loadData').addEventListener('click', () => this.loadExistingData());
        document.getElementById('reviewResults').addEventListener('click', () => this.goToStep2());
        document.getElementById('forceLoadResults').addEventListener('click', () => this.forceLoadToStep2());
        document.getElementById('approveAndContinue').addEventListener('click', () => this.goToStep3());
        document.getElementById('backToReview').addEventListener('click', () => this.goToStep2());
        document.getElementById('manageCollection').addEventListener('click', () => this.loadCollectionAsGames());
        document.getElementById('dataFileInput').addEventListener('change', (e) => this.handleFileLoad(e));
        document.getElementById('gameSearchBox').addEventListener('input', (e) => this.searchCachedGames(e.target.value));
        document.getElementById('removePlayedFromCollection').addEventListener('click', () => this.removePlayedFromCollection());
        document.getElementById('clearCollection').addEventListener('click', () => this.clearGameCollection());
        document.getElementById('gameSearch').addEventListener('input', (e) => this.filterGames(e.target.value));
        document.getElementById('sortBy').addEventListener('change', (e) => this.setSortBy(e.target.value));
        document.getElementById('sortOrder').addEventListener('click', () => this.toggleSortOrder());
        document.getElementById('hidePlayedGames').addEventListener('change', (e) => this.toggleHidePlayedGames(e.target.checked));
        
        // Auto-save API key and Steam ID
        document.getElementById('steamApiKey').addEventListener('input', (e) => {
            localStorage.setItem('steamApiKey', e.target.value);
        });
        
        document.getElementById('steamId').addEventListener('blur', (e) => {
            localStorage.setItem('steamId', e.target.value);
        });
        
        // Handle fetch mode changes
        document.getElementById('fetchMode').addEventListener('change', (e) => {
            this.fetchMode = e.target.value;
            localStorage.setItem('fetchMode', e.target.value);
            this.updateUIForCurrentStep();
        });
        
        // Load saved values
        const savedApiKey = localStorage.getItem('steamApiKey');
        if (savedApiKey) {
            document.getElementById('steamApiKey').value = savedApiKey;
        }
        
        const savedSteamId = localStorage.getItem('steamId');
        if (savedSteamId) {
            document.getElementById('steamId').value = savedSteamId;
        }
        
        const savedFetchMode = localStorage.getItem('fetchMode');
        if (savedFetchMode) {
            document.getElementById('fetchMode').value = savedFetchMode;
            this.fetchMode = savedFetchMode;
        }
        
        const savedStep = localStorage.getItem('currentStep');
        if (savedStep) {
            this.currentStep = parseInt(savedStep);
        }
        
        const savedHidePlayedGames = localStorage.getItem('hidePlayedGames');
        if (savedHidePlayedGames === 'true') {
            document.getElementById('hidePlayedGames').checked = true;
            this.hidePlayedGames = true;
        }
        
        // Initialize collection display and search
        this.updateCollectionDisplay();
        this.searchCachedGames(''); // Initialize empty search
        
        // Check if data collection is complete
        this.checkDataCollectionStatus();
        
        // Initialize UI based on current step
        this.updateUIForCurrentStep();
        
        // Auto-load results if we're in Step 2/3 and have data
        this.initializeStepData();
    }

    checkDataCollectionStatus() {
        // Check if we have cached data that indicates previous collection
        const hasSteamCache = Object.keys(this.steamGamesCache).length > 0;
        const hasBeatTimesCache = Object.keys(this.beatTimesCache).length > 0;
        const hasCustomBeatTimes = Object.keys(this.customBeatTimes).length > 0;
        
        // Data collection is complete if we have steam cache and some form of beat times data
        // OR if we explicitly chose games-only mode
        this.dataCollectionComplete = hasSteamCache && (
            hasBeatTimesCache || 
            hasCustomBeatTimes || 
            this.fetchMode === 'games-only'
        );
        
        console.log('Data collection status:', {
            hasSteamCache,
            hasBeatTimesCache,
            hasCustomBeatTimes,
            fetchMode: this.fetchMode,
            dataCollectionComplete: this.dataCollectionComplete
        });
    }

    initializeStepData() {
        // Auto-load appropriate data based on current step and available cache
        if (this.currentStep === 2) {
            if (this.dataCollectionComplete) {
                // Load results overview for Step 2 only
                this.showResultsOverview();
                console.log(`Auto-loaded results overview for Step 2 from cached data`);
            } else if (Object.keys(this.steamGamesCache).length > 0 || Object.keys(this.beatTimesCache).length > 0) {
                // If we have some cached data but it's not complete, go back to Step 1
                console.log('Incomplete cached data found, returning to Step 1');
                this.currentStep = 1;
                this.updateUIForCurrentStep();
            }
        } else if (this.currentStep === 3) {
            if (this.dataCollectionComplete) {
                // Step 3 is collection management only
                this.updateCollectionDisplay();
                this.searchCachedGames('');
                console.log(`Auto-loaded collection management for Step 3`);
            } else {
                // If no complete data, go back to Step 1
                console.log('No complete data found, returning to Step 1');
                this.currentStep = 1;
                this.updateUIForCurrentStep();
            }
        }
    }

    updateUIForCurrentStep() {
        // Get all UI elements
        const steamInputs = document.querySelectorAll('.steam-input, .api-input');
        const loadDataInput = document.getElementById('loadDataInput');
        const jsonSection = document.getElementById('jsonSection');
        const step2Section = document.getElementById('step2Section');
        const step3Section = document.getElementById('step3Section');
        const fetchModeSelect = document.getElementById('fetchMode');
        const resultsOverview = document.getElementById('resultsOverview');
        const gamesGrid = document.getElementById('gamesGrid');
        const controls = document.getElementById('controls');
        
        // Get all buttons
        const fetchGamesBtn = document.getElementById('fetchGames');
        const loadDataBtn = document.getElementById('loadData');
        const reviewResultsBtn = document.getElementById('reviewResults');
        const forceLoadBtn = document.getElementById('forceLoadResults');
        const approveBtn = document.getElementById('approveAndContinue');
        const backToReviewBtn = document.getElementById('backToReview');
        const manageCollectionBtn = document.getElementById('manageCollection');
        
        // Hide all by default
        steamInputs.forEach(input => input.style.display = 'none');
        loadDataInput.style.display = 'none';
        jsonSection.style.display = 'none';
        step2Section.style.display = 'none';
        step3Section.style.display = 'none';
        resultsOverview.style.display = 'none';
        gamesGrid.style.display = 'none';
        controls.style.display = 'none';
        
        fetchGamesBtn.style.display = 'none';
        loadDataBtn.style.display = 'none';
        reviewResultsBtn.style.display = 'none';
        forceLoadBtn.style.display = 'none';
        approveBtn.style.display = 'none';
        backToReviewBtn.style.display = 'none';
        manageCollectionBtn.style.display = 'none';
        
        // Show appropriate UI based on current step
        switch (this.currentStep) {
            case 1: // Data Source
                if (this.fetchMode === 'load-existing') {
                    loadDataInput.style.display = 'block';
                    loadDataBtn.style.display = 'inline-block';
                } else {
                    steamInputs.forEach(input => input.style.display = 'block');
                    fetchGamesBtn.style.display = 'inline-block';
                }
                // Show force load button if we have cached data
                if (Object.keys(this.steamGamesCache).length > 0 || Object.keys(this.beatTimesCache).length > 0) {
                    forceLoadBtn.style.display = 'inline-block';
                }
                fetchModeSelect.disabled = false;
                break;
                
            case 2: // Review Results
                step2Section.style.display = 'block';
                resultsOverview.style.display = 'block';
                approveBtn.style.display = 'inline-block';
                fetchModeSelect.disabled = true;
                fetchModeSelect.title = 'Step 1 complete. Review your results below.';
                // Hide action buttons in Step 2 (view-only)
                this.hideResultsActionButtons();
                break;
                
            case 3: // Manage Collection
                step3Section.style.display = 'block';
                jsonSection.style.display = 'block';
                gamesGrid.style.display = 'grid';
                controls.style.display = 'flex';
                manageCollectionBtn.style.display = 'inline-block';
                backToReviewBtn.style.display = 'inline-block';
                fetchModeSelect.disabled = true;
                fetchModeSelect.title = 'Data collection complete. Use Step 3 to manage your collection.';
                // No results overview in Step 3
                break;
        }
        
        // Save current step
        localStorage.setItem('currentStep', this.currentStep.toString());
    }

    hideResultsActionButtons() {
        // Show Step 2 specific buttons (reset/remove beta), hide Step 3 buttons (export)
        const step2Actions = document.querySelector('.step2-only-actions');
        const step3Actions = document.querySelector('.step3-only-actions');
        
        if (step2Actions) step2Actions.style.display = 'flex';
        if (step3Actions) step3Actions.style.display = 'none';
        
        // Hide category action buttons (except View All)
        document.querySelectorAll('.category-actions').forEach(actionsDiv => {
            const buttons = actionsDiv.querySelectorAll('button');
            buttons.forEach(button => {
                if (!button.textContent.includes('View All')) {
                    button.style.display = 'none';
                }
            });
        });
    }

    async fetchSteamGames() {
        const steamId = this.extractSteamId(document.getElementById('steamId').value);
        const apiKey = document.getElementById('steamApiKey').value;

        if (!steamId || !apiKey) {
            this.showError('Please provide both Steam ID and API Key');
            return;
        }

        try {
            this.showLoading('Loading Steam games...');
            this.hideError();

            const games = await this.getSteamGames(steamId, apiKey);
            
            if (!games || games.length === 0) {
                this.showError('No games found. Make sure your Steam profile is public and the API key is correct.');
                return;
            }

            this.games = games;
            this.filteredGames = [...games];
            
            // Save Steam games to cache for JSON mode
            this.saveSteamGamesCache(games);
            
            this.hideLoading();
            this.showControls();
            this.renderGames();
            this.updateStats();

            // Start fetching beat times based on mode
            if (this.fetchMode === 'games-beattimes') {
                this.totalGamesToFetch = games.length;
                this.gamesFetched = 0;
                this.showProgressBar();
                this.fetchAllBeatTimes();
            } else {
                // For games-only mode, data collection is complete immediately
                this.onDataCollectionComplete();
            }

        } catch (error) {
            console.error('Error fetching Steam games:', error);
            this.showError(`Failed to fetch Steam games: ${error.message}`);
            this.hideLoading();
        }
    }

    extractSteamId(input) {
        if (!input) return null;
        
        // If it's already a Steam ID (numeric)
        if (/^\d{17}$/.test(input)) {
            return input;
        }
        
        // Extract from Steam profile URL
        const profileMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
        if (profileMatch) {
            return profileMatch[1];
        }
        
        // Extract from Steam ID URL (custom URL - would need additional API call)
        const idMatch = input.match(/steamcommunity\.com\/id\/([^/]+)/);
        if (idMatch) {
            this.showError('Custom Steam URLs are not supported yet. Please use your numeric Steam ID or profile URL.');
            return null;
        }
        
        return input; // Assume it's a Steam ID
    }

    async getSteamGames(steamId, apiKey) {
        const url = `https://api.berkankutuk.dk/api/hltb/steamGames?steamid=${steamId}&key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Steam API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.response || !data.response.games) {
                throw new Error('Invalid response from Steam API');
            }
            
            return data.response.games.map(game => ({
                appid: game.appid,
                name: game.name,
                playtime_forever: Math.floor(game.playtime_forever / 60), // Convert to hours
                img_icon_url: game.img_icon_url,
                beatTimes: null,
                beatTimesLoading: false,
                beatTimesError: null
            }));
        } catch (error) {
            throw error;
        }
    }

    async fetchAllBeatTimes() {
        const batchSize = 50; // Limit concurrent requests
        let index = 0;
        
        while (index < this.games.length) {
            const batch = this.games.slice(index, index + batchSize);
            const promises = batch.map(game => this.fetchBeatTimeForGame(game));
            
            await Promise.allSettled(promises);
            
            // Update display after each batch
            this.renderGames();
            this.updateStats();
            this.updateProgress();
            
            index += batchSize;
            
            // Small delay between batches to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.hideProgressBar();
        this.saveBeatTimesCache();
        this.onDataCollectionComplete();
    }

    onDataCollectionComplete() {
        this.dataCollectionComplete = true;
        
        // Save original cache backup when data collection first completes
        this.saveOriginalCacheBackup();
        
        // Move to Step 2 (Review Results)
        this.currentStep = 2;
        this.updateUIForCurrentStep();
        this.showResultsOverview();
        
        console.log('Data collection complete! Moving to Step 2 - Review Results.');
    }

    goToStep2() {
        this.currentStep = 2;
        this.categoryViewType = null; // Clear any category view
        
        // Restore back button text
        const backBtn = document.getElementById('backToReview');
        if (backBtn) {
            backBtn.textContent = '← Back to Review (Step 2)';
        }
        
        this.updateUIForCurrentStep();
        this.showResultsOverview();
    }

    goToStep3() {
        this.currentStep = 3;
        this.updateUIForCurrentStep();
        
        // Step 3 is collection management only - no results overview
        // Show collection interface and initialize search
        this.updateCollectionDisplay();
        this.searchCachedGames('');
    }

    forceLoadToStep2() {
        // Force load cached data into Step 2 even if data collection wasn't complete
        if (Object.keys(this.steamGamesCache).length === 0 && Object.keys(this.beatTimesCache).length === 0) {
            alert('No cached data found. Please fetch games first or load existing data.');
            return;
        }
        
        this.dataCollectionComplete = true;
        this.currentStep = 2;
        this.updateUIForCurrentStep();
        this.showResultsOverview();
        
        console.log('Forced loading cached data to Step 2');
    }

    loadExistingData() {
        const fileInput = document.getElementById('dataFileInput');
        fileInput.click();
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate the data structure
                if (!data.steamGamesCache || !data.beatTimesCache) {
                    throw new Error('Invalid data file format. Missing required cache data.');
                }

                // Load the data into the application
                this.steamGamesCache = data.steamGamesCache;
                this.beatTimesCache = data.beatTimesCache;
                this.customBeatTimes = data.customBeatTimes || this.beatTimesCache;
                this.gameCollection = data.gameCollection || {};

                // Save to localStorage
                localStorage.setItem('steamGamesCache', JSON.stringify(this.steamGamesCache));
                localStorage.setItem('beatTimesCache', JSON.stringify(this.beatTimesCache));
                localStorage.setItem('customBeatTimes', JSON.stringify(this.customBeatTimes));
                localStorage.setItem('gameCollection', JSON.stringify(this.gameCollection));

                // Mark data collection as complete and move to Step 2
                this.dataCollectionComplete = true;
                this.currentStep = 2;
                this.updateUIForCurrentStep();
                this.showResultsOverview();

                console.log('Data loaded successfully from file');
            } catch (error) {
                console.error('Failed to load data file:', error);
                alert('Failed to load data file. Please ensure it\'s a valid collection export.');
            }
        };
        reader.readAsText(file);
    }

    exportCollection() {
        try {
            const exportData = {
                steamGamesCache: this.steamGamesCache,
                beatTimesCache: this.beatTimesCache,
                customBeatTimes: this.customBeatTimes,
                gameCollection: this.gameCollection,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `steam_collection_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('Collection data exported successfully');
        } catch (error) {
            console.error('Failed to export collection:', error);
            alert('Failed to export collection data. Please try again.');
        }
    }

    saveOriginalCacheBackup() {
        try {
            // Save a backup of the original beat times cache
            const originalBackup = JSON.stringify(this.beatTimesCache);
            localStorage.setItem('originalBeatTimesCache', originalBackup);
            console.log('Original cache backup saved');
        } catch (error) {
            console.error('Failed to save original cache backup:', error);
        }
    }

    applyCachedBeatTimes() {
        this.games.forEach(game => {
            const cachedBeatTimes = this.beatTimesCache[game.name.toLowerCase()];
            if (cachedBeatTimes) {
                game.beatTimes = cachedBeatTimes;
            }
        });
    }
    
    cleanGameTitle(title) {
        return title
            // Remove trademark, copyright, and registered symbols (including various Unicode versions)
            .replace(/[™®©℗℠]/g, '')
            .replace(/\(TM\)/gi, '')
            .replace(/\(R\)/gi, '')
            .replace(/\(C\)/gi, '')
            // Remove special punctuation at the end
            .replace(/[!?]+$/g, '')
            // Remove common edition markers
            .replace(/\s*\b(Game of the Year|GOTY|Definitive|Enhanced|Complete|Ultimate|Deluxe|Premium|Gold|Platinum|Collector's?)\s*(Edition)?\b/gi, '')
            // Remove year editions
            .replace(/\s*\b(20\d{2})\s*(Edition)?\b/gi, '')
            // Remove platform indicators
            .replace(/\s*\b(PC|Steam|Windows)\s*(Edition|Version)?\b/gi, '')
            // Remove other common suffixes
            .replace(/\s*\b(Remastered|HD|Director's Cut|Special Edition)\b/gi, '')
            // Clean up extra spaces and dashes
            .replace(/\s+/g, ' ')
            .replace(/\s*-\s*$/, '')
            .trim();
    }

    async fetchBeatTimeForGame(game) {
        if (game.beatTimesLoading || game.beatTimes) return;
        
        // Check cache first (only if not in use-cached mode, which already applied cache)
        if (this.fetchMode !== 'use-cached') {
            const cachedBeatTimes = this.beatTimesCache[game.name.toLowerCase()];
            if (cachedBeatTimes) {
                game.beatTimes = cachedBeatTimes;
                this.gamesFetched++;
                return;
            }
        }
        
        game.beatTimesLoading = true;
        this.incrementLoadingCount();
        
        try {
            // Try original name first
            let searchName = game.name;
            let response = await fetch(`https://api.berkankutuk.dk/api/hltb/search?q=${encodeURIComponent(searchName)}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            let data = await response.json();
            
            // If no results with original name, try cleaned name
            if (!data.results || data.results.length === 0) {
                const cleanedName = this.cleanGameTitle(game.name);
                if (cleanedName !== game.name) {
                    console.log(`No results for "${game.name}", trying cleaned name: "${cleanedName}"`);
                    response = await fetch(`https://api.berkankutuk.dk/api/hltb/search?q=${encodeURIComponent(cleanedName)}`);
                    if (response.ok) {
                        data = await response.json();
                        searchName = cleanedName;
                    }
                }
            }
            
            if (data.results && data.results.length > 0) {
                // Find the best match (exact match or first result)
                const bestMatch = data.results.find(result => 
                    result.title.toLowerCase() === searchName.toLowerCase()
                ) || data.results[0];
                
                game.beatTimes = bestMatch.times;
                // Cache the result under the original name
                this.beatTimesCache[game.name.toLowerCase()] = bestMatch.times;
            } else {
                game.beatTimes = null;
            }
        } catch (error) {
            console.error(`Failed to fetch beat times for ${game.name}:`, error);
            game.beatTimesError = error.message;
        } finally {
            game.beatTimesLoading = false;
            this.decrementLoadingCount();
            this.gamesFetched++;
        }
    }

    incrementLoadingCount() {
        this.loadingCount++;
        this.updateStats();
    }

    decrementLoadingCount() {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        this.updateStats();
    }

    filterGames(searchTerm) {
        let filtered = [...this.games];
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(game => 
                game.name.toLowerCase().includes(term)
            );
        }
        
        // Apply played games filter
        if (this.hidePlayedGames) {
            filtered = filtered.filter(game => game.playtime_forever === 0);
        }
        
        this.filteredGames = filtered;
        this.sortGames();
        this.renderGames();
        this.updateStats();
    }

    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this.sortGames();
        this.renderGames();
    }

    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        const button = document.getElementById('sortOrder');
        button.textContent = this.sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending';
        
        this.sortGames();
        this.renderGames();
    }

    sortGames() {
        this.filteredGames.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'playtime':
                    aValue = a.playtime_forever || 0;
                    bValue = b.playtime_forever || 0;
                    break;
                case 'main':
                case 'mainExtra':
                case 'completionist':
                case 'allStyles':
                    aValue = a.beatTimes?.[this.sortBy] || 0;
                    bValue = b.beatTimes?.[this.sortBy] || 0;
                    break;
                default:
                    return 0;
            }
            
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? 
                    aValue.localeCompare(bValue) : 
                    bValue.localeCompare(aValue);
            } else {
                return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });
    }

    renderGames() {
        const grid = document.getElementById('gamesGrid');
        grid.innerHTML = '';
        
        this.filteredGames.forEach(game => {
            const gameCard = this.createGameCard(game);
            grid.appendChild(gameCard);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        
        const iconUrl = game.img_icon_url ? 
            `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : 
            null;
        
        const escapedName = game.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        // Unified remove button (shows in Step 2 and Step 3)
        const removeButton = this.dataCollectionComplete && (this.currentStep === 2 || this.currentStep === 3) ? 
            `<button class="unified-remove-btn" onclick="app.removeGameCompletely('${escapedName}')" title="Remove from cache and collection">
                Remove
            </button>` : '';
        
        // Small top-left remove button for successful games in View All mode (Step 2.5)
        const topLeftRemoveButton = (this.currentStep === 2.5 && this.categoryViewType === 'success' && game.beatTimes && !game.beatTimesError) ?
            `<button class="top-left-remove-btn" onclick="app.removeGameCompletely('${escapedName}')" title="Remove this game">
                ×
            </button>` : '';
        
        // No per-game reset button anymore
        
        card.innerHTML = `
            ${topLeftRemoveButton}
            <div class="game-header">
                <div class="game-title-row">
                    ${iconUrl ? `
                        <img src="${iconUrl}" alt="${this.escapeHtml(game.name)} icon" class="game-icon" 
                             onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+PzwvdGV4dD48L3N2Zz4=';" />
                    ` : `
                        <div class="game-icon-placeholder">?</div>
                    `}
                    <div class="game-title clickable" onclick="app.openSteamStorePage('${game.appid}')" title="Open Steam store page">
                        ${this.escapeHtml(game.name)}
                    </div>
                </div>
                <div class="steam-playtime">Steam Playtime: ${game.playtime_forever}h</div>
                <div class="header-buttons">
                    ${removeButton}
                </div>
            </div>
            <div class="beat-times ${this.getBeatTimesClass(game)}">
                ${this.renderBeatTimes(game)}
            </div>
        `;
        
        return card;
    }

    getBeatTimesClass(game) {
        if (game.beatTimesLoading) return 'loading';
        if (game.beatTimesError) return 'error';
        return '';
    }

    renderBeatTimes(game) {
        if (game.beatTimesLoading) {
            return '<div class="loading-spinner"></div>Loading beat times...';
        }
        
        if (game.beatTimesError) {
            return `Error: ${game.beatTimesError}`;
        }
        
        if (!game.beatTimes) {
            const escapedName = game.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `
                <div class="no-beat-time-data">
                    <div>No beat time data found</div>
                    <div class="no-data-actions">
                        <button class="rename-game-btn" onclick="app.showRenameDialog('${escapedName}', '${game.appid}')">
                            Rename & Retry
                        </button>
                        <button class="delete-no-data-btn" onclick="app.deleteGameFromDisplay('${escapedName}')">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }
        
        const times = game.beatTimes;
        const timeLabels = {
            main: 'Main Story',
            mainExtra: 'Main + Extras',
            completionist: 'Completionist',
            allStyles: 'All Styles'
        };
        
        return Object.entries(timeLabels)
            .map(([key, label]) => {
                const value = times[key];
                const displayValue = value ? `${value}h` : 'No data';
                const valueClass = value ? 'time-value' : 'time-value no-data';
                
                return `
                    <div class="time-row">
                        <span class="time-label">${label}:</span>
                        <span class="${valueClass}">${displayValue}</span>
                    </div>
                `;
            })
            .join('');
    }

    updateStats() {
        document.getElementById('gameCount').textContent = `${this.filteredGames.length} games`;
    }

    showLoading(message) {
        const loading = document.getElementById('loadingIndicator');
        loading.querySelector('p').textContent = message;
        loading.style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loadingIndicator').style.display = 'none';
    }

    showControls() {
        document.getElementById('controls').style.display = 'flex';
    }

    showError(message) {
        const error = document.getElementById('errorMessage');
        error.textContent = message;
        error.style.display = 'block';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    loadBeatTimesCache() {
        try {
            const cached = localStorage.getItem('beatTimesCache');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.error('Failed to load beat times cache:', error);
            return {};
        }
    }
    
    loadCustomBeatTimes() {
        try {
            const custom = localStorage.getItem('customBeatTimes');
            if (custom) {
                return JSON.parse(custom);
            } else {
                // Initialize customBeatTimes from beatTimesCache if it doesn't exist
                const customCopy = JSON.parse(JSON.stringify(this.beatTimesCache));
                this.saveCustomBeatTimes(customCopy);
                return customCopy;
            }
        } catch (error) {
            console.error('Failed to load custom beat times:', error);
            return {};
        }
    }
    
    saveCustomBeatTimes(customBeatTimes = null) {
        try {
            const dataToSave = customBeatTimes || this.customBeatTimes;
            localStorage.setItem('customBeatTimes', JSON.stringify(dataToSave));
            if (customBeatTimes) {
                this.customBeatTimes = customBeatTimes;
            }
        } catch (error) {
            console.error('Failed to save custom beat times:', error);
        }
    }
    
    loadSteamGamesCache() {
        try {
            const cached = localStorage.getItem('steamGamesCache');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.error('Failed to load Steam games cache:', error);
            return {};
        }
    }
    
    saveSteamGamesCache(games) {
        try {
            // Store games by name for easy lookup
            const gamesLookup = {};
            games.forEach(game => {
                gamesLookup[game.name.toLowerCase()] = {
                    name: game.name,
                    playtime_forever: game.playtime_forever,
                    appid: game.appid,
                    img_icon_url: game.img_icon_url
                };
            });
            localStorage.setItem('steamGamesCache', JSON.stringify(gamesLookup));
            this.steamGamesCache = gamesLookup;
        } catch (error) {
            console.error('Failed to save Steam games cache:', error);
        }
    }
    
    saveBeatTimesCache() {
        try {
            localStorage.setItem('beatTimesCache', JSON.stringify(this.beatTimesCache));
            // Refresh search if in Step 3 (manage collection)
            if (this.dataCollectionComplete && this.currentStep === 3) {
                const query = document.getElementById('gameSearchBox').value;
                this.searchCachedGames(query);
            }
        } catch (error) {
            console.error('Failed to save beat times cache:', error);
        }
    }
    
    
    showProgressBar() {
        const progressContainer = document.createElement('div');
        progressContainer.id = 'progressContainer';
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
            <div class="progress-label">Fetching beat times...</div>
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">0 / ${this.totalGamesToFetch}</div>
        `;
        
        const controls = document.getElementById('controls');
        controls.parentNode.insertBefore(progressContainer, controls.nextSibling);
    }
    
    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            const percentage = (this.gamesFetched / this.totalGamesToFetch) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${this.gamesFetched} / ${this.totalGamesToFetch}`;
        }
    }
    
    hideProgressBar() {
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    
    loadGameCollection() {
        try {
            const cached = localStorage.getItem('gameCollection');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.error('Failed to load game collection:', error);
            return {};
        }
    }
    
    saveGameCollection() {
        try {
            localStorage.setItem('gameCollection', JSON.stringify(this.gameCollection));
        } catch (error) {
            console.error('Failed to save game collection:', error);
        }
    }
    
    searchCachedGames(query) {
        const searchResults = document.getElementById('searchResults');
        
        if (!query.trim()) {
            searchResults.innerHTML = '<div style="padding: 10px; color: #b0b0b0; text-align: center;">Start typing to search games...</div>';
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const matchingGames = [];
        
        // Search through all cached games
        Object.keys(this.beatTimesCache).forEach(gameName => {
            if (gameName.includes(lowerQuery) && !this.gameCollection[gameName]) {
                const steamData = this.steamGamesCache[gameName] || {};
                const beatTimes = this.beatTimesCache[gameName];
                
                matchingGames.push({
                    name: steamData.name || this.capitalizeGameName(gameName),
                    key: gameName,
                    playtime_forever: steamData.playtime_forever || 0,
                    beatTimes: beatTimes
                });
            }
        });
        
        if (matchingGames.length === 0) {
            searchResults.innerHTML = '<div style="padding: 10px; color: #b0b0b0; text-align: center;">No matching games found</div>';
            return;
        }
        
        searchResults.innerHTML = matchingGames.slice(0, 10).map((game, index) => `
            <div class="search-result-item">
                <div>
                    <div class="search-result-name">${this.escapeHtml(game.name)}</div>
                    <div class="search-result-playtime">${game.playtime_forever}h played</div>
                </div>
                <button class="add-game-btn" onclick="app.addToCollectionByIndex(${index})" data-game-key="${this.escapeHtml(game.key)}">
                    Add
                </button>
            </div>
        `).join('');
        
        // Store the current search results for the addToCollectionByIndex method
        this.currentSearchResults = matchingGames.slice(0, 10);
    }
    
    addToCollection(gameKey) {
        const steamData = this.steamGamesCache[gameKey] || {};
        const beatTimes = this.beatTimesCache[gameKey];
        
        this.gameCollection[gameKey] = {
            name: steamData.name || this.capitalizeGameName(gameKey),
            playtime_forever: steamData.playtime_forever || 0,
            appid: steamData.appid,
            img_icon_url: steamData.img_icon_url,
            beatTimes: beatTimes
        };
        
        this.saveGameCollection();
        this.updateCollectionDisplay();
        
        // Refresh search to remove added game
        const query = document.getElementById('gameSearchBox').value;
        this.searchCachedGames(query);
    }
    
    addToCollectionByIndex(index) {
        if (this.currentSearchResults && this.currentSearchResults[index]) {
            const game = this.currentSearchResults[index];
            this.addToCollection(game.key);
        }
    }
    
    removeFromCollection(gameKey) {
        delete this.gameCollection[gameKey];
        this.saveGameCollection();
        this.updateCollectionDisplay();
        
        // Refresh search to show removed game again
        const query = document.getElementById('gameSearchBox').value;
        this.searchCachedGames(query);
    }
    
    removeFromCollectionByIndex(index) {
        if (this.currentCollectionKeys && this.currentCollectionKeys[index]) {
            const gameKey = this.currentCollectionKeys[index];
            this.removeFromCollection(gameKey);
        }
    }
    
    updateCollectionDisplay() {
        const collectionList = document.getElementById('collectionList');
        const collectionCount = document.getElementById('collectionCount');
        const gameKeys = Object.keys(this.gameCollection);
        
        collectionCount.textContent = gameKeys.length;
        
        if (gameKeys.length === 0) {
            collectionList.innerHTML = '<div style="padding: 10px; color: #b0b0b0; text-align: center;">No games in collection. Search and add games above.</div>';
            return;
        }
        
        collectionList.innerHTML = gameKeys.map((gameKey, index) => {
            const game = this.gameCollection[gameKey];
            const mainTime = game.beatTimes?.main || 'N/A';
            return `
                <div class="collection-item">
                    <div class="collection-item-info">
                        <div class="collection-item-name">${this.escapeHtml(game.name)}</div>
                        <div class="collection-item-details">${game.playtime_forever}h played • Main: ${mainTime}h</div>
                    </div>
                    <button class="remove-from-collection-btn" onclick="app.removeFromCollectionByIndex(${index})" data-game-key="${this.escapeHtml(gameKey)}">
                        Remove
                    </button>
                </div>
            `;
        }).join('');
        
        // Store the current collection keys for the removeFromCollectionByIndex method
        this.currentCollectionKeys = gameKeys;
    }
    
    loadCollectionAsGames() {
        const gameKeys = Object.keys(this.gameCollection);
        
        if (gameKeys.length === 0) {
            this.showError('No games in your collection. Add some games first.');
            return;
        }
        
        // Convert collection to games array
        const collectionGames = gameKeys.map(gameKey => {
            const game = this.gameCollection[gameKey];
            return {
                name: game.name,
                playtime_forever: game.playtime_forever,
                appid: game.appid || Math.random().toString(36).substr(2, 9),
                img_icon_url: game.img_icon_url || null,
                beatTimes: game.beatTimes,
                beatTimesLoading: false,
                beatTimesError: null
            };
        });
        
        this.hideError();
        this.games = collectionGames;
        this.filteredGames = [...collectionGames];
        
        this.showControls();
        this.renderGames();
        this.updateStats();
        
        console.log(`Loaded ${collectionGames.length} games from collection`);
    }
    
    capitalizeGameName(gameName) {
        // Convert lowercase game name back to a more readable format
        return gameName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    clearGameCollection() {
        if (confirm('Are you sure you want to clear your entire game collection?')) {
            this.gameCollection = {};
            this.saveGameCollection();
            this.updateCollectionDisplay();
            
            // Refresh search to show all games again
            const query = document.getElementById('gameSearchBox').value;
            this.searchCachedGames(query);
            
            console.log('Cleared game collection');
        }
    }
    
    deleteGame(gameName) {
        // Remove from current games array
        this.games = this.games.filter(game => game.name !== gameName);
        this.filteredGames = this.filteredGames.filter(game => game.name !== gameName);
        
        // Remove from customBeatTimes
        const updatedCustomBeatTimes = {...this.customBeatTimes};
        delete updatedCustomBeatTimes[gameName.toLowerCase()];
        this.saveCustomBeatTimes(updatedCustomBeatTimes);
        
        // Update JSON textarea
        this.updateJsonFromCache();
        
        // Re-render the games
        this.renderGames();
        this.updateStats();
        
        console.log(`Deleted "${gameName}" from custom collection`);
    }
    
    removePlayedFromCollection() {
        const playedGameKeys = Object.keys(this.gameCollection).filter(key => 
            this.gameCollection[key].playtime_forever > 0
        );
        
        if (playedGameKeys.length === 0) {
            alert('No played games found in your collection.');
            return;
        }
        
        if (confirm(`Are you sure you want to remove ${playedGameKeys.length} played games from your collection?`)) {
            playedGameKeys.forEach(key => {
                delete this.gameCollection[key];
            });
            
            this.saveGameCollection();
            this.updateCollectionDisplay();
            
            // Refresh search to show removed games again
            const query = document.getElementById('gameSearchBox').value;
            this.searchCachedGames(query);
            
            console.log(`Removed ${playedGameKeys.length} played games from collection`);
        }
    }
    
    toggleHidePlayedGames(hide) {
        this.hidePlayedGames = hide;
        localStorage.setItem('hidePlayedGames', hide.toString());
        
        // Re-apply current search filter
        const searchTerm = document.getElementById('gameSearch').value;
        this.filterGames(searchTerm);
    }
    
    openSteamStorePage(appid) {
        if (appid && appid !== 'undefined') {
            const steamUrl = `https://store.steampowered.com/app/${appid}`;
            window.open(steamUrl, '_blank');
        }
    }

    showRenameDialog(originalName, appid) {
        const cleanedSuggestion = this.cleanGameTitle(originalName);
        const suggestedName = cleanedSuggestion !== originalName ? cleanedSuggestion : originalName;
        
        const newName = prompt(`Current name: "${originalName}"\n\nEnter a new name to search for beat times:`, suggestedName);
        
        if (newName && newName.trim() && newName !== originalName) {
            this.refetchBeatTimeWithNewName(originalName, newName.trim(), appid);
        }
    }

    async refetchBeatTimeWithNewName(originalName, newName, appid) {
        // Find the game in the current games array
        const game = this.games.find(g => g.name === originalName);
        if (!game) return;

        // Reset beat time data
        game.beatTimes = null;
        game.beatTimesError = null;
        game.beatTimesLoading = true;

        // Update display to show loading
        this.renderGames();

        try {
            const response = await fetch(`https://api.berkankutuk.dk/api/hltb/search?q=${encodeURIComponent(newName)}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Find the best match (exact match or first result)
                const bestMatch = data.results.find(result => 
                    result.title.toLowerCase() === newName.toLowerCase()
                ) || data.results[0];
                
                game.beatTimes = bestMatch.times;
                
                // Update both the original name cache and new name cache
                const originalNameKey = originalName.toLowerCase();
                const newNameKey = newName.toLowerCase();
                
                // Cache the result with both the original name and new name
                this.beatTimesCache[originalNameKey] = bestMatch.times;
                this.beatTimesCache[newNameKey] = bestMatch.times;
                
                // Also update custom beat times cache if it exists
                if (this.customBeatTimes[originalNameKey] !== undefined) {
                    this.customBeatTimes[originalNameKey] = bestMatch.times;
                }
                if (this.customBeatTimes[newNameKey] !== undefined) {
                    this.customBeatTimes[newNameKey] = bestMatch.times;
                }
                
                this.saveBeatTimesCache();
                this.saveCustomBeatTimes();
                
                console.log(`Successfully updated beat times for "${originalName}" using search term "${newName}"`);
            } else {
                game.beatTimesError = `No results found for "${newName}"`;
            }
        } catch (error) {
            console.error(`Failed to fetch beat times for renamed game "${newName}":`, error);
            game.beatTimesError = error.message;
        } finally {
            game.beatTimesLoading = false;
            this.renderGames();
        }
    }

    removeBeatTimes(gameName) {
        const gameNameKey = gameName.toLowerCase();
        
        // Remove from beat times cache
        delete this.beatTimesCache[gameNameKey];
        
        // Remove from custom beat times cache
        delete this.customBeatTimes[gameNameKey];
        
        // Find and update the game in current games array
        const game = this.games.find(g => g.name === gameName);
        if (game) {
            game.beatTimes = null;
            game.beatTimesError = null;
            game.beatTimesLoading = false;
        }
        
        // Update games in collection if they exist
        if (this.gameCollection[gameNameKey]) {
            this.gameCollection[gameNameKey].beatTimes = null;
        }
        
        // Completely remove entries from localStorage
        try {
            const beatTimesCache = JSON.parse(localStorage.getItem('beatTimesCache') || '{}');
            delete beatTimesCache[gameNameKey];
            localStorage.setItem('beatTimesCache', JSON.stringify(beatTimesCache));
            
            const customBeatTimes = JSON.parse(localStorage.getItem('customBeatTimes') || '{}');
            delete customBeatTimes[gameNameKey];
            localStorage.setItem('customBeatTimes', JSON.stringify(customBeatTimes));
            
            const gameCollection = JSON.parse(localStorage.getItem('gameCollection') || '{}');
            if (gameCollection[gameNameKey]) {
                gameCollection[gameNameKey].beatTimes = null;
                localStorage.setItem('gameCollection', JSON.stringify(gameCollection));
            }
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
        
        // Re-render games to show updated state (don't change step or data collection status)
        if (this.currentStep === 2) {
            this.showResultsOverview(); // Rebuilds from cache
        } else if (this.currentStep === 2.5) {
            // In view-all mode, just re-analyze current games
            this.analyzeAndDisplayResults();
            this.renderGames();
            this.updateStats();
        } else if (this.currentStep === 3) {
            this.renderGames();
        }
        
        console.log(`Completely removed cached beat times for "${gameName}" from all storage`);
    }

    deleteGameFromDisplay(gameName) {
        const gameNameKey = gameName.toLowerCase();
        
        // Remove from current games arrays
        this.games = this.games.filter(game => game.name !== gameName);
        this.filteredGames = this.filteredGames.filter(game => game.name !== gameName);
        
        // Remove from all cache objects
        delete this.beatTimesCache[gameNameKey];
        delete this.customBeatTimes[gameNameKey];
        delete this.gameCollection[gameNameKey];
        delete this.steamGamesCache[gameNameKey];
        
        // Remove from localStorage completely
        try {
            const beatTimesCache = JSON.parse(localStorage.getItem('beatTimesCache') || '{}');
            delete beatTimesCache[gameNameKey];
            localStorage.setItem('beatTimesCache', JSON.stringify(beatTimesCache));
            
            const customBeatTimes = JSON.parse(localStorage.getItem('customBeatTimes') || '{}');
            delete customBeatTimes[gameNameKey];
            localStorage.setItem('customBeatTimes', JSON.stringify(customBeatTimes));
            
            const gameCollection = JSON.parse(localStorage.getItem('gameCollection') || '{}');
            delete gameCollection[gameNameKey];
            localStorage.setItem('gameCollection', JSON.stringify(gameCollection));
            
            const steamGamesCache = JSON.parse(localStorage.getItem('steamGamesCache') || '{}');
            delete steamGamesCache[gameNameKey];
            localStorage.setItem('steamGamesCache', JSON.stringify(steamGamesCache));
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
        
        // Re-render games and update stats (don't change step or data collection status)
        if (this.currentStep === 2) {
            this.showResultsOverview(); // Rebuilds from cache
        } else if (this.currentStep === 2.5) {
            // In view-all mode, just re-analyze current games
            this.analyzeAndDisplayResults();
            this.renderGames();
            this.updateStats();
        } else if (this.currentStep === 3) {
            this.renderGames();
            this.updateStats();
        }
        
        console.log(`Completely deleted "${gameName}" from display and all storage`);
    }

    showResultsOverview() {
        // Load all games from steam cache to analyze
        const allGames = [];
        Object.values(this.steamGamesCache).forEach(steamGame => {
            const beatTimes = this.beatTimesCache[steamGame.name.toLowerCase()];
            allGames.push({
                name: steamGame.name,
                playtime_forever: steamGame.playtime_forever,
                appid: steamGame.appid,
                img_icon_url: steamGame.img_icon_url,
                beatTimes: beatTimes,
                beatTimesError: null
            });
        });

        this.games = allGames;
        this.filteredGames = [...allGames];
        this.analyzeAndDisplayResults();
    }

    analyzeAndDisplayResults() {
        const successful = this.games.filter(game => game.beatTimes && !game.beatTimesError);
        const errors = this.games.filter(game => game.beatTimesError);
        const noData = this.games.filter(game => !game.beatTimes && !game.beatTimesError);

        // Update counts
        document.getElementById('successCount').textContent = successful.length;
        document.getElementById('errorCount').textContent = errors.length;
        document.getElementById('noDataCount').textContent = noData.length;

        // Update stats
        const totalGames = this.games.length;
        const successRate = ((successful.length / totalGames) * 100).toFixed(1);
        document.getElementById('resultsStats').innerHTML = `
            <div class="stat">Total Games: <strong>${totalGames}</strong></div>
            <div class="stat">Success Rate: <strong>${successRate}%</strong></div>
            <div class="stat">Beat Times Found: <strong>${successful.length}</strong></div>
        `;

        // Show preview of each category
        this.showCategoryPreview('successList', successful, 'success');
        this.showCategoryPreview('errorsList', errors, 'error');
        this.showCategoryPreview('noDataList', noData, 'nodata');
    }

    showCategoryPreview(containerId, games, type) {
        const container = document.getElementById(containerId);
        const previewLimit = 5;
        const preview = games.slice(0, previewLimit);
        
        if (games.length === 0) {
            container.innerHTML = '<div class="empty-category">No games in this category</div>';
            return;
        }

        const itemsHtml = preview.map(game => {
            let statusInfo = '';
            switch (type) {
                case 'success':
                    const mainTime = game.beatTimes?.main || 'N/A';
                    statusInfo = `<span class="status-info success">Main: ${mainTime}h</span>`;
                    break;
                case 'error':
                    statusInfo = `<span class="status-info error">${game.beatTimesError}</span>`;
                    break;
                case 'nodata':
                    statusInfo = `<span class="status-info nodata">No data found</span>`;
                    break;
            }

            return `
                <div class="preview-item">
                    <div class="preview-item-info">
                        <div class="preview-item-name">${this.escapeHtml(game.name)}</div>
                        ${statusInfo}
                    </div>
                    <div class="preview-item-actions">
                        ${this.currentStep === 2.5 ? `
                            ${type === 'error' ? `<button class="btn-small retry" onclick="app.retryGame('${this.escapeHtml(game.name)}')">Retry</button>` : ''}
                            ${type === 'nodata' ? `<button class="btn-small rename" onclick="app.showRenameDialog('${this.escapeHtml(game.name)}', '${game.appid}')">Rename</button>` : ''}
                            <button class="btn-small remove" onclick="app.removeGameCompletely('${this.escapeHtml(game.name)}')">Remove</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        const moreText = games.length > previewLimit ? 
            `<div class="more-items">... and ${games.length - previewLimit} more</div>` : '';

        container.innerHTML = itemsHtml + moreText;
    }

    showCategory(type) {
        // Enter view-all mode (special mode between Step 2 and 3)
        this.currentStep = 2.5; // Special view-all mode
        this.categoryViewType = type;
        
        // Show appropriate UI elements
        document.getElementById('resultsOverview').style.display = 'none';
        document.getElementById('gamesGrid').style.display = 'grid';
        document.getElementById('controls').style.display = 'flex';
        
        // Show back to review button
        const backBtn = document.getElementById('backToReview');
        if (backBtn) {
            backBtn.style.display = 'inline-block';
            backBtn.textContent = '← Back to Results Overview';
        }
        
        // Apply filter based on type
        const searchInput = document.getElementById('gameSearch');
        searchInput.value = '';
        
        switch (type) {
            case 'success':
                this.filteredGames = this.games.filter(game => game.beatTimes && !game.beatTimesError);
                break;
            case 'errors':
                this.filteredGames = this.games.filter(game => game.beatTimesError);
                break;
            case 'nodata':
                this.filteredGames = this.games.filter(game => !game.beatTimes && !game.beatTimesError);
                break;
        }
        
        this.renderGames();
        this.updateStats();
    }

    retryGame(gameName) {
        const game = this.games.find(g => g.name === gameName);
        if (game) {
            game.beatTimesError = null;
            game.beatTimes = null;
            this.fetchBeatTimeForGame(game).then(() => {
                this.analyzeAndDisplayResults();
            });
        }
    }

    retryAllErrors() {
        const errorGames = this.games.filter(game => game.beatTimesError);
        if (errorGames.length === 0) return;
        
        errorGames.forEach(game => {
            game.beatTimesError = null;
            game.beatTimes = null;
        });
        
        this.totalGamesToFetch = errorGames.length;
        this.gamesFetched = 0;
        this.showProgressBar();
        
        // Fetch beat times for error games
        Promise.allSettled(errorGames.map(game => this.fetchBeatTimeForGame(game)))
            .then(() => {
                this.hideProgressBar();
                this.saveBeatTimesCache();
                this.analyzeAndDisplayResults();
            });
    }

    removeAllErrors() {
        const errorGames = this.games.filter(game => game.beatTimesError);
        errorGames.forEach(game => this.removeGameCompletely(game.name));
    }

    removeAllNoData() {
        const noDataGames = this.games.filter(game => !game.beatTimes && !game.beatTimesError && !game.beatTimesLoading);
        noDataGames.forEach(game => this.removeGameCompletely(game.name));
    }

    exportSuccessful() {
        const successful = this.games.filter(game => game.beatTimes && !game.beatTimesError);
        const csvContent = "data:text/csv;charset=utf-8," + 
            "Game Name,Main Story,Main + Extras,Completionist,All Styles,Steam Playtime\n" +
            successful.map(game => {
                const times = game.beatTimes;
                return `"${game.name}","${times.main || 'N/A'}","${times.mainExtra || 'N/A'}","${times.completionist || 'N/A'}","${times.allStyles || 'N/A'}","${game.playtime_forever}h"`;
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "steam_games_beat_times.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    removeGameCompletely(gameName) {
        // This replaces both removeBeatTimes and deleteGameFromDisplay
        const gameNameKey = gameName.toLowerCase();
        
        // Remove from current games arrays
        this.games = this.games.filter(game => game.name !== gameName);
        this.filteredGames = this.filteredGames.filter(game => game.name !== gameName);
        
        // Remove from all cache objects
        delete this.beatTimesCache[gameNameKey];
        delete this.customBeatTimes[gameNameKey];
        delete this.gameCollection[gameNameKey];
        delete this.steamGamesCache[gameNameKey];
        
        // Remove from localStorage completely
        try {
            const beatTimesCache = JSON.parse(localStorage.getItem('beatTimesCache') || '{}');
            delete beatTimesCache[gameNameKey];
            localStorage.setItem('beatTimesCache', JSON.stringify(beatTimesCache));
            
            const customBeatTimes = JSON.parse(localStorage.getItem('customBeatTimes') || '{}');
            delete customBeatTimes[gameNameKey];
            localStorage.setItem('customBeatTimes', JSON.stringify(customBeatTimes));
            
            const gameCollection = JSON.parse(localStorage.getItem('gameCollection') || '{}');
            delete gameCollection[gameNameKey];
            localStorage.setItem('gameCollection', JSON.stringify(gameCollection));
            
            const steamGamesCache = JSON.parse(localStorage.getItem('steamGamesCache') || '{}');
            delete steamGamesCache[gameNameKey];
            localStorage.setItem('steamGamesCache', JSON.stringify(steamGamesCache));
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
        
        // Re-render games and update stats (don't change step or data collection status)
        if (this.currentStep === 2) {
            this.showResultsOverview(); // Rebuilds from cache
        } else if (this.currentStep === 2.5) {
            // In view-all mode, just re-analyze current games
            this.analyzeAndDisplayResults();
            this.renderGames();
            this.updateStats();
        } else if (this.currentStep === 3) {
            this.renderGames();
            this.updateStats();
        }
        
        console.log(`Completely removed "${gameName}" from all caches and storage`);
    }

    removeTestGames() {
        // Find games with exact words "beta", "demo", or "test" in their titles from localStorage cache
        const testKeywords = ['beta', 'demo', 'test'];
        const testGames = [];
        
        // Search through steamGamesCache
        Object.keys(this.steamGamesCache).forEach(gameKey => {
            const steamGame = this.steamGamesCache[gameKey];
            const gameName = steamGame.name || gameKey;
            
            // Clean title by removing semicolons and dashes before checking
            const cleanedName = gameName.toLowerCase().replace(/[;:-]/g, ' ');
            
            // Use word boundaries to match exact words only
            const hasTestKeyword = testKeywords.some(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                return regex.test(cleanedName);
            });
            
            if (hasTestKeyword) {
                testGames.push({
                    name: gameName,
                    key: gameKey,
                    source: 'steam'
                });
            }
        });
        
        // Also search through beatTimesCache for any additional games
        Object.keys(this.beatTimesCache).forEach(gameKey => {
            const gameName = this.capitalizeGameName(gameKey);
            
            // Skip if already found in steam cache
            if (testGames.some(game => game.key === gameKey)) {
                return;
            }
            
            // Clean title by removing semicolons and dashes before checking
            const cleanedName = gameName.toLowerCase().replace(/[;:-]/g, ' ');
            
            // Use word boundaries to match exact words only
            const hasTestKeyword = testKeywords.some(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                return regex.test(cleanedName);
            });
            
            if (hasTestKeyword) {
                testGames.push({
                    name: gameName,
                    key: gameKey,
                    source: 'beatTimes'
                });
            }
        });
        
        if (testGames.length === 0) {
            alert('No beta, demo, or test games found in your cached data.');
            return;
        }
        
        const gameNames = testGames.map(game => game.name).join('\n• ');
        if (!confirm(`Remove ${testGames.length} beta/demo/test games from your cached data?\n\n• ${gameNames}`)) {
            return;
        }
        
        // Remove each test game from all localStorage objects
        let removedCount = 0;
        testGames.forEach(game => {
            this.removeGameCompletely(game.name);
            removedCount++;
        });
        
        console.log(`Removed ${removedCount} beta/demo/test games from cached data`);
        
        // Update the results display if we're in Step 2 or 3
        if (this.currentStep === 2 || this.currentStep === 3) {
            this.showResultsOverview();
        }
    }

    resetToOriginalCache() {
        if (!confirm('Reset all beat times to the original cache from when data collection first completed? This will undo all manual changes.')) {
            return;
        }
        
        try {
            // Load the original backup
            const originalBackup = localStorage.getItem('originalBeatTimesCache');
            if (!originalBackup) {
                alert('No original cache backup found. This feature is only available after initial data collection.');
                return;
            }
            
            // Restore the original beat times cache
            const originalBeatTimes = JSON.parse(originalBackup);
            this.beatTimesCache = originalBeatTimes;
            
            // Update localStorage with restored cache
            localStorage.setItem('beatTimesCache', originalBackup);
            
            // Reset custom beat times to match original
            this.customBeatTimes = JSON.parse(JSON.stringify(originalBeatTimes));
            localStorage.setItem('customBeatTimes', JSON.stringify(this.customBeatTimes));
            
            // Update current games with restored data
            this.games.forEach(game => {
                const gameKey = game.name.toLowerCase();
                const originalBeatTime = originalBeatTimes[gameKey];
                
                if (originalBeatTime) {
                    game.beatTimes = originalBeatTime;
                    game.beatTimesError = null;
                } else {
                    game.beatTimes = null;
                    game.beatTimesError = null;
                }
                game.beatTimesLoading = false;
            });
            
            // Update game collection with restored data
            Object.keys(this.gameCollection).forEach(gameKey => {
                const originalBeatTime = originalBeatTimes[gameKey];
                if (this.gameCollection[gameKey]) {
                    this.gameCollection[gameKey].beatTimes = originalBeatTime || null;
                }
            });
            localStorage.setItem('gameCollection', JSON.stringify(this.gameCollection));
            
            // Re-render display
            if (this.currentStep === 2) {
                this.analyzeAndDisplayResults();
            } else {
                this.renderGames();
                this.updateStats();
            }
            
            console.log('Reset to original beat times cache completed');
            
        } catch (error) {
            console.error('Failed to reset to original cache:', error);
            alert('Failed to reset to original cache. Please try again.');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SteamGameBeatTimes();
});