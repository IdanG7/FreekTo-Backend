/**
 * TV Remote-friendly navigation system
 * Handles keyboard navigation similar to a TV remote control
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation system
    const navSystem = new TVNavigation();
    navSystem.init();
});

class TVNavigation {
    constructor() {
        // Navigation elements
        this.mainNav = document.getElementById('main-nav');
        this.navItems = document.querySelectorAll('.nav-item');
        this.contentSections = document.querySelectorAll('.content-section');
        this.movieGrids = document.querySelectorAll('.movies-grid');
        
        // Current navigation state
        this.currentSection = 'trending';
        this.activeNavItem = null;
        this.activeGrid = null;
        this.activeItem = null;
        
        // Special elements
        this.searchInput = document.getElementById('search-input');
        this.searchButton = document.getElementById('search-button');
        this.videoPlayer = document.getElementById('video-player');
        this.movieDetails = document.getElementById('movie-details');
        this.closeDetails = document.getElementById('close-details');
        this.closePlayer = document.getElementById('close-player');
        this.playButton = document.getElementById('play-button');
        
        // Navigation state
        this.navigationHistory = [];
        this.isInNavBar = true;
        this.isInSearchInput = false;
        this.isInVideoPlayer = false;
        this.isInMovieDetails = false;
    }
    
    init() {
        // Set up initial navigation
        this.setupEventListeners();
        this.focusNavItem(this.navItems[0]);
        
        // Set up movie items click handlers
        document.addEventListener('movieItemsLoaded', () => {
            const movieItems = document.querySelectorAll('.movie-item');
            movieItems.forEach(item => {
                item.addEventListener('click', () => this.openMovieDetails(item));
                item.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter') {
                        this.openMovieDetails(item);
                    }
                });
            });
        });
        
        // Initialize modal controls
        this.closeDetails.addEventListener('click', () => this.closeMovieDetails());
        this.closePlayer.addEventListener('click', () => this.closeVideoPlayer());
        this.playButton.addEventListener('click', () => this.playCurrentMovie());
    }
    
    setupEventListeners() {
        // Set up keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyNavigation(e));
        
        // Set up navigation item click handlers
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.navigateToSection(section);
                this.focusNavItem(item);
            });
        });
        
        // Search button handler
        this.searchButton.addEventListener('click', () => {
            if (this.searchInput.value.trim()) {
                // Trigger search (handled in app.js)
                const event = new CustomEvent('performSearch', {
                    detail: { query: this.searchInput.value.trim() }
                });
                document.dispatchEvent(event);
            } else {
                this.searchInput.focus();
            }
        });
    }
    
    handleKeyNavigation(e) {
        // Do nothing if in video player and not ESC key
        if (this.isInVideoPlayer && e.key !== 'Escape' && e.key !== 'Back' && e.key !== 'Backspace') {
            return;
        }
        
        // Handle search input separately
        if (this.isInSearchInput) {
            if (e.key === 'Enter') {
                this.searchButton.click();
                return;
            }
            if (e.key === 'Escape' || e.key === 'Back' || e.key === 'Backspace' && this.searchInput.value === '') {
                this.exitSearchInput();
                return;
            }
            return;
        }
        
        // Movie details navigation
        if (this.isInMovieDetails) {
            if (e.key === 'Escape' || e.key === 'Back' || e.key === 'Backspace') {
                this.closeMovieDetails();
                return;
            }
            if (e.key === 'Enter') {
                this.playCurrentMovie();
                return;
            }
            return;
        }
        
        // Video player navigation
        if (this.isInVideoPlayer) {
            if (e.key === 'Escape' || e.key === 'Back' || e.key === 'Backspace') {
                this.closeVideoPlayer();
                return;
            }
            return;
        }
        
        // Main navigation
        switch(e.key) {
            case 'ArrowLeft':
                this.navigateHorizontal(-1);
                break;
            case 'ArrowRight':
                this.navigateHorizontal(1);
                break;
            case 'ArrowUp':
                this.navigateVertical(-1);
                break;
            case 'ArrowDown':
                this.navigateVertical(1);
                break;
            case 'Enter':
                this.handleEnterKey();
                break;
            case 'Escape':
            case 'Back':
            case 'Backspace':
                this.handleBackKey();
                break;
        }
    }
    
    navigateHorizontal(direction) {
        if (this.isInNavBar) {
            // Navigate between nav items
            const currentIndex = Array.from(this.navItems).indexOf(this.activeNavItem);
            const newIndex = Math.max(0, Math.min(this.navItems.length - 1, currentIndex + direction));
            this.focusNavItem(this.navItems[newIndex]);
        } else {
            // Navigate between grid items
            if (!this.activeGrid || !this.activeItem) return;
            
            const gridItems = Array.from(this.activeGrid.querySelectorAll('.movie-item'));
            if (gridItems.length === 0) return;
            
            const currentIndex = gridItems.indexOf(this.activeItem);
            const rowSize = Math.floor(this.activeGrid.offsetWidth / gridItems[0].offsetWidth);
            
            // Calculate new position while staying in same row
            const row = Math.floor(currentIndex / rowSize);
            const col = currentIndex % rowSize;
            const newCol = Math.max(0, Math.min(rowSize - 1, col + direction));
            const newIndex = row * rowSize + newCol;
            
            if (newIndex >= 0 && newIndex < gridItems.length && newCol !== col) {
                this.focusGridItem(gridItems[newIndex]);
            }
        }
    }
    
    navigateVertical(direction) {
        if (this.isInNavBar) {
            if (direction > 0) {
                // Move from nav bar to content
                this.isInNavBar = false;
                
                // Try to focus search input if in search section
                if (this.currentSection === 'search') {
                    this.focusSearchInput();
                } else {
                    // Otherwise focus first grid item
                    const activeSection = document.getElementById(this.currentSection);
                    if (!activeSection) return;
                    
                    const grid = activeSection.querySelector('.movies-grid');
                    this.activeGrid = grid;
                    
                    const firstItem = grid.querySelector('.movie-item');
                    if (firstItem) {
                        this.focusGridItem(firstItem);
                    }
                }
            }
        } else if (this.isInSearchInput) {
            if (direction > 0) {
                // Move from search input to search results
                this.exitSearchInput();
                
                const grid = document.getElementById('search-results');
                this.activeGrid = grid;
                
                const firstItem = grid.querySelector('.movie-item');
                if (firstItem) {
                    this.focusGridItem(firstItem);
                }
            } else {
                // Move from search input to nav bar
                this.exitSearchInput();
                this.isInNavBar = true;
                
                // Find the search nav item
                const searchNav = Array.from(this.navItems).find(item => item.dataset.section === 'search');
                if (searchNav) {
                    this.focusNavItem(searchNav);
                }
            }
        } else {
            // Navigate within content grid
            if (!this.activeGrid || !this.activeItem) {
                if (direction < 0) {
                    // Move to nav bar if trying to go up
                    this.isInNavBar = true;
                    const navItem = Array.from(this.navItems).find(item => item.dataset.section === this.currentSection);
                    if (navItem) {
                        this.focusNavItem(navItem);
                    }
                }
                return;
            }
            
            if (direction < 0 && this.activeItem === this.activeGrid.querySelector('.movie-item')) {
                // If first item and going up, move to nav or search input
                if (this.currentSection === 'search' && this.searchInput.value) {
                    this.focusSearchInput();
                } else {
                    this.isInNavBar = true;
                    const navItem = Array.from(this.navItems).find(item => item.dataset.section === this.currentSection);
                    if (navItem) {
                        this.focusNavItem(navItem);
                    }
                }
                return;
            }
            
            const gridItems = Array.from(this.activeGrid.querySelectorAll('.movie-item'));
            if (gridItems.length === 0) return;
            
            const currentIndex = gridItems.indexOf(this.activeItem);
            const rowSize = Math.floor(this.activeGrid.offsetWidth / gridItems[0].offsetWidth);
            
            const newIndex = currentIndex + (direction * rowSize);
            if (newIndex >= 0 && newIndex < gridItems.length) {
                this.focusGridItem(gridItems[newIndex]);
            }
        }
    }
    
    handleEnterKey() {
        if (this.isInNavBar) {
            // Activate selected nav item
            const section = this.activeNavItem.dataset.section;
            this.navigateToSection(section);
        } else if (this.activeItem) {
            // Open movie details for selected item
            this.openMovieDetails(this.activeItem);
        }
    }
    
    handleBackKey() {
        if (!this.isInNavBar) {
            // Return to nav bar
            this.isInNavBar = true;
            const navItem = Array.from(this.navItems).find(item => item.dataset.section === this.currentSection);
            if (navItem) {
                this.focusNavItem(navItem);
            }
        }
    }
    
    focusNavItem(item) {
        // Clear previous selection
        this.navItems.forEach(navItem => navItem.classList.remove('selected'));
        
        // Set new selection
        item.classList.add('selected');
        this.activeNavItem = item;
        
        // Update current section
        this.currentSection = item.dataset.section;
        this.navigateToSection(this.currentSection);
    }
    
    focusGridItem(item) {
        if (this.activeItem) {
            this.activeItem.blur();
        }
        item.focus();
        this.activeItem = item;
    }
    
    focusSearchInput() {
        this.isInSearchInput = true;
        this.searchInput.focus();
    }
    
    exitSearchInput() {
        this.isInSearchInput = false;
        this.searchInput.blur();
    }
    
    navigateToSection(section) {
        // Hide all sections
        this.contentSections.forEach(sec => sec.classList.remove('active'));
        
        // Show selected section
        const selectedSection = document.getElementById(section);
        if (selectedSection) {
            selectedSection.classList.add('active');
        }
        
        // Update active grid
        const grid = selectedSection.querySelector('.movies-grid');
        if (grid) {
            this.activeGrid = grid;
        }
    }
    
    openMovieDetails(movieItem) {
        // Get movie data from the item
        const movieId = movieItem.dataset.id;
        const title = movieItem.querySelector('.movie-title').textContent;
        const posterSrc = movieItem.querySelector('img').src;
        
        // Update details modal with movie info
        document.getElementById('detail-title').textContent = title;
        document.getElementById('detail-poster').src = posterSrc;
        document.getElementById('play-button').dataset.id = movieId;
        
        // Show movie details
        this.movieDetails.classList.remove('hidden');
        this.isInMovieDetails = true;
        
        // Focus the play button
        this.playButton.focus();
    }
    
    closeMovieDetails() {
        this.movieDetails.classList.add('hidden');
        this.isInMovieDetails = false;
        
        // Return focus to the movie item
        if (this.activeItem) {
            this.activeItem.focus();
        }
    }
    
    playCurrentMovie() {
        const movieId = this.playButton.dataset.id;
        if (!movieId) return;
        
        // Close details and show video player
        this.closeMovieDetails();
        this.openVideoPlayer(movieId);
    }
    
    openVideoPlayer(movieId) {
        // Show video player
        this.videoPlayer.classList.remove('hidden');
        this.isInVideoPlayer = true;
        
        // Load the video (handled in app.js)
        const event = new CustomEvent('loadVideo', {
            detail: { id: movieId }
        });
        document.dispatchEvent(event);
    }
    
    closeVideoPlayer() {
        // Pause the video
        const video = document.getElementById('main-video');
        if (video) {
            video.pause();
        }
        
        // Hide player
        this.videoPlayer.classList.add('hidden');
        this.isInVideoPlayer = false;
        
        // Return focus to content
        if (this.activeItem) {
            this.activeItem.focus();
        }
    }
}
