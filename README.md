# FreekTo TV Backend API

This is the backend API server for the FreekTo TV Android app. It scrapes data from freek.to and provides endpoints for trending movies, search functionality, and video playback.

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. The server will run at http://localhost:8080

## Deploying to Render.com (Free Tier)

1. Create a free account on [Render.com](https://render.com)

2. From your Render dashboard, click "New" and select "Web Service"

3. Connect your GitHub account or upload the code directly

4. Configure your web service:
   - Name: `freekto-tv-api`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the Free plan

5. Click "Create Web Service"

6. Your API will be available at the URL provided by Render (something like `https://freekto-tv-api.onrender.com`)

7. Update your Android app's `Config.java` file with this new URL

## API Endpoints

- `/` - Welcome message and available endpoints
- `/trending` - Get trending movies scraped from freek.to
- `/search?q=query` - Search for movies on freek.to
- `/video/:id` - Extract and get video URL for a specific movie

## Features

- **Real-time Scraping**: The backend scrapes data directly from freek.to to provide up-to-date content
- **Robust Parsing**: Uses multiple selector strategies to handle website structure changes
- **Intelligent Fallbacks**: If scraping fails, falls back to mock data to ensure the app always works
- **Caching**: Implements in-memory caching to reduce load on the freek.to website and improve performance
- **Error Handling**: Comprehensive error handling with detailed logging for troubleshooting

## Deployment Notes

- The backend is designed to work with free hosting on Render.com
- The Android app is configured with multiple backup endpoints in case the primary one is unavailable
- For production use, consider implementing rate limiting to avoid overloading the source website
