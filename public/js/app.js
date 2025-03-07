/**
 * FreekTo TV Web App
 * Main application logic to fetch and display content
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize app
    const app = new FreekToApp();
    app.init();
});

class FreekToApp {
    constructor() {
        // API endpoints - use relative URLs to work on both development and production
        this.apiEndpoints = {
            trending: '/trending',
            search: '/search',
            video: '/video'
        };
        
        // DOM elements
        this.trendingGrid = document.getElementById('trending-movies');
        this.moviesGrid = document.getElementById('movies-grid');
        this.seriesGrid = document.getElementById('series-grid');
        this.searchResults = document.getElementById('search-results');
        this.searchInput = document.getElementById('search-input');
        this.videoPlayer = document.getElementById('main-video');
        this.videoTitle = document.getElementById('video-title');
        
        // Templates
        this.movieTemplate = document.getElementById('movie-template');
    }
    
    init() {
        // Load initial data
        this.loadTrendingMovies();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Handle search
        document.getElementById('search-button').addEventListener('click', () => {
            const query = this.searchInput.value.trim();
            if (query) {
                this.performSearch(query);
            }
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = this.searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                }
            }
        });
        
        // Custom events from navigation system
        document.addEventListener('performSearch', (e) => {
            this.performSearch(e.detail.query);
        });
        
        document.addEventListener('loadVideo', (e) => {
            this.loadVideo(e.detail.id);
        });
    }
    
    async loadTrendingMovies() {
        try {
            this.showLoading(this.trendingGrid);
            
            // Fetch trending movies from API
            const response = await fetch(this.apiEndpoints.trending);
            const data = await response.json();
            
            // Clear loading indicator
            this.clearGrid(this.trendingGrid);
            
            // Populate trending grid with movies
            if (data.movies && data.movies.length > 0) {
                data.movies.forEach(movie => {
                    this.addMovieToGrid(movie, this.trendingGrid);
                });
                
                // Use the same data for movies grid initially
                this.clearGrid(this.moviesGrid);
                data.movies.forEach(movie => {
                    this.addMovieToGrid(movie, this.moviesGrid);
                });
                
                // Also add some to series grid as placeholder
                this.clearGrid(this.seriesGrid);
                data.movies.slice(0, 5).forEach(movie => {
                    this.addMovieToGrid({...movie, title: movie.title + ' Series'}, this.seriesGrid);
                });
                
                // Notify that movie items have been loaded (for keyboard navigation)
                document.dispatchEvent(new Event('movieItemsLoaded'));
            } else {
                this.showError(this.trendingGrid, 'No trending movies found');
            }
        } catch (error) {
            console.error('Error loading trending movies:', error);
            this.showError(this.trendingGrid, 'Failed to load trending movies');
        }
    }
    
    async performSearch(query) {
        try {
            this.showLoading(this.searchResults);
            
            // Fetch search results from API
            const response = await fetch(`${this.apiEndpoints.search}?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            // Clear loading indicator
            this.clearGrid(this.searchResults);
            
            // Populate search results
            if (data.results && data.results.length > 0) {
                data.results.forEach(movie => {
                    this.addMovieToGrid(movie, this.searchResults);
                });
                
                // Notify that movie items have been loaded (for keyboard navigation)
                document.dispatchEvent(new Event('movieItemsLoaded'));
            } else {
                this.showError(this.searchResults, `No results found for "${query}"`);
            }
        } catch (error) {
            console.error('Error performing search:', error);
            this.showError(this.searchResults, 'Search failed. Please try again');
        }
    }
    
    async loadVideo(id) {
        try {
            // Show loading state
            this.videoPlayer.src = '';
            this.videoTitle.textContent = 'Loading...';
            
            // Fetch video URL from API
            const response = await fetch(`${this.apiEndpoints.video}/${id}`);
            const data = await response.json();
            
            if (data.videoUrl) {
                // Set video source and play
                this.videoPlayer.src = data.videoUrl;
                this.videoTitle.textContent = data.title || 'Now Playing';
                
                // Try to play the video
                try {
                    const playPromise = this.videoPlayer.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.error('AutoPlay failed:', error);
                            // Show play button for user interaction
                            const playButton = document.createElement('button');
                            playButton.textContent = 'Play Video';
                            playButton.classList.add('primary-button');
                            playButton.style.position = 'absolute';
                            playButton.style.top = '50%';
                            playButton.style.left = '50%';
                            playButton.style.transform = 'translate(-50%, -50%)';
                            playButton.addEventListener('click', () => {
                                this.videoPlayer.play();
                                playButton.remove();
                            });
                            document.getElementById('video-player').appendChild(playButton);
                        });
                    }
                } catch (e) {
                    console.error('Error playing video:', e);
                }
            } else {
                this.videoTitle.textContent = 'Video not available';
            }
        } catch (error) {
            console.error('Error loading video:', error);
            this.videoTitle.textContent = 'Failed to load video';
        }
    }
    
    addMovieToGrid(movie, grid) {
        // Clone the template
        const template = this.movieTemplate.content.cloneNode(true);
        const movieItem = template.querySelector('.movie-item');
        
        // Set movie data
        const posterImg = movieItem.querySelector('img');
        posterImg.src = movie.image || 'images/placeholder.jpg';
        posterImg.alt = movie.title;
        
        movieItem.querySelector('.movie-title').textContent = movie.title;
        
        // Set movie ID from link
        if (movie.link) {
            const id = movie.link.split('/').pop();
            movieItem.dataset.id = id;
        }
        
        // Add tabindex to make focusable
        movieItem.setAttribute('tabindex', '0');
        
        // Add to grid
        grid.appendChild(movieItem);
    }
    
    clearGrid(grid) {
        // Remove all child elements except template
        while (grid.firstChild) {
            grid.removeChild(grid.firstChild);
        }
    }
    
    showLoading(grid) {
        this.clearGrid(grid);
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Loading...';
        grid.appendChild(loading);
    }
    
    showError(grid, message) {
        this.clearGrid(grid);
        const error = document.createElement('div');
        error.className = 'loading';
        error.textContent = message;
        grid.appendChild(error);
    }
}
