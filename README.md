# FreekTo TV Backend API

This is the backend API server for the FreekTo TV Android app. It provides endpoints for trending movies and search functionality.

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
- `/trending` - Get trending movies
- `/search?q=query` - Search for movies
- `/video/:id` - Get video URL for a specific movie

## Notes

- This is a simplified implementation with sample data
- In a production environment, you would implement actual scraping logic for freek.to
- The API uses in-memory caching to reduce load and improve performance
