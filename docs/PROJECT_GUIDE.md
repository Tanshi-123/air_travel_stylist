# AI Travel Stylist Project Guide

This project should be built in phases. The full product vision is big: weather, culture, wardrobe computer vision, social trend analysis, shopping, packing, local discovery, and dance coaching. The safest path is to ship a polished MVP first, then replace demo services with real APIs and models.

## 1. Product Modules

Build the app as six modules:

1. Destination intelligence
   - Input: destination and trip length.
   - Output: weather, climate, fashion profile, cultural notes, activities, nightlife, social signals.

2. Wardrobe digitization
   - Input: clothing images.
   - Output: category, color, material, pattern, season, style, formality, breathability.

3. Outfit engine
   - Input: destination profile plus user wardrobe.
   - Output: day and night outfits with match scores.

4. Missing item engine
   - Input: destination requirements plus owned wardrobe.
   - Output: missing products and shopping search links.

5. Packing assistant
   - Input: destination profile plus trip days.
   - Output: clothing, accessories, documents, and local-prep checklist.

6. Dance coach
   - Input: destination nightlife/dance signal.
   - Output: tutorial steps now, real-time pose scoring later.

## 2. Current Structure

```text
ai_travel_stylist/
  backend/
    app.py
    requirements.txt
    services/
      destination_intelligence.py
      wardrobe_service.py
      outfit_service.py
      shopping_service.py
      packing_service.py
      dance_service.py
  frontend/
    app/
      page.tsx
      layout.tsx
      globals.css
    components/
      TravelStylistApp.tsx
    lib/
      api.ts
    package.json
  src/
    database.py
    vision_tagger.py
    recommender.py
    dance_coach.py
  data/
  main.py
```

Use `src/` as your learning/prototype area. Use `backend/` and `frontend/` as the app you will grow into production.

## 3. Backend Setup

From the project root:

```powershell
.\.venv\Scripts\python.exe -m backend.app
```

The API runs at:

```text
http://127.0.0.1:5000
```

Useful endpoints:

```text
GET  /api/health
POST /api/destination/analyze
GET  /api/wardrobe
POST /api/wardrobe/upload
POST /api/outfits
POST /api/packing-list
GET  /api/local-experiences
GET  /api/dance-plan
POST /api/dance/evaluate
```

Example:

```powershell
curl -X POST http://127.0.0.1:5000/api/destination/analyze `
  -H "Content-Type: application/json" `
  -d "{\"destination\":\"Goa\",\"tripDays\":4}"
```

## 4. Frontend Setup

From the `frontend/` folder:

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

For future sessions, you can launch both servers from the project root:

```powershell
.\start-dev.ps1
```

The frontend expects the backend at `http://127.0.0.1:5000`. To change it, create `frontend/.env.local`:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

## 5. Database Plan

The MVP uses SQLite at:

```text
data/travel_stylist.db
```

Current app table:

```text
wardrobe_items
  id
  image_path
  original_filename
  category
  color
  color_hex
  material
  pattern
  style
  season
  breathable
  formality
  created_at
```

Production tables to add:

```text
users
trips
destinations
wardrobe_items
outfits
packing_lists
trend_snapshots
shopping_recommendations
dance_sessions
pose_scores
```

When you move beyond local development, use PostgreSQL or Firebase/Firestore.

## 6. Replace Demo Services With Real APIs

Start with these replacements:

1. Weather
   - Replace hardcoded weather in `backend/services/destination_intelligence.py`.
   - Use a weather provider API.
   - Store temperature, humidity, rain probability, wind speed, and condition.

2. Places and local activities
   - Add Google Maps Places or another travel activity API.
   - Rank activities by destination, time, category, and popularity.

3. Social trend intelligence
   - Avoid uncontrolled scraping.
   - Prefer official APIs, approved creator data, Google Trends, YouTube Data API, and licensed trend providers.
   - Store normalized signals like colors, clothing categories, accessories, venues, music, and dance hooks.

4. Shopping
   - Replace `shopping_service.py` search links with official product APIs or affiliate feeds.
   - Keep price, rating, merchant, image, availability, and deeplink fields.

5. AI styling
   - Add an AI gateway service rather than calling a model directly from routes.
   - Give the model structured destination, wardrobe, and cultural data.
   - Ask for JSON output with outfit explanations, risk notes, and confidence.

6. Computer vision
   - Upgrade `wardrobe_service.py` from filename/color heuristics to:
     - garment detection
     - segmentation
     - background removal
     - category classification
     - fabric/material estimation
   - Good future candidates: FashionCLIP, YOLO, Segment Anything, Detectron-style pipelines, or a hosted vision model.

7. Dance coaching
   - MVP: tutorial steps and pose-angle comparison API.
   - Next: run MediaPipe Pose or MoveNet in the browser.
   - Send normalized joint angles to `/api/dance/evaluate`.
   - Keep camera frames on-device for privacy whenever possible.

## 7. AI Scoring Formula

For every wardrobe item, score:

```text
score =
  weather suitability
  + trend match
  + color popularity
  + cultural fit
  + activity fit
  + user preference
  - discomfort risk
```

Example factors:

```text
Hot weather + linen shirt       -> bonus
High humidity + leather jacket  -> penalty
Temple visit + revealing outfit -> penalty
Nightlife + smart black shirt   -> bonus
Goa + sandals                   -> bonus
Paris dinner + flip-flops       -> penalty
```

## 8. MVP Build Order

Build in this order:

1. Destination search page.
2. Weather and cultural profile card.
3. Wardrobe upload and item list.
4. Outfit matching with demo wardrobe.
5. Packing checklist.
6. Missing item shopping cards.
7. Local experiences.
8. Dance tutorial mode.
9. Camera-based pose tracking.
10. Login, cloud storage, payments, and production deployment.

## 9. Production Checklist

Before launch:

```text
Authentication
Image upload limits
Privacy policy for wardrobe and camera data
API key security
Merchant API compliance
Social platform terms compliance
Error monitoring
Analytics
Database backups
Mobile performance testing
Accessibility testing
```

## 10. What To Code Next

The highest-value next coding step is real weather integration:

1. Add `WEATHER_API_KEY` to `backend/.env`.
2. Create `backend/services/weather_client.py`.
3. Fetch live forecast by destination.
4. Replace the static `weather` object in `analyze_destination`.
5. Recalculate clothing suitability from live weather.

After that, add browser-based MediaPipe Pose in the frontend for dance coaching.
