# AI Travel Stylist

Mobile-first AI travel companion that combines destination intelligence, wardrobe digitization, outfit matching, packing, shopping gaps, local experiences, and dance practice.

This repo now has two layers:

- `main.py` and `src/`: your original Python prototype.
- `backend/` and `frontend/`: a production-shaped Flask API plus Next.js app scaffold.

Start the backend:

```powershell
.\.venv\Scripts\python.exe -m backend.app
```

Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

Or start both from the project root:

```powershell
.\start-dev.ps1
```

Read the full build guide in [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).
