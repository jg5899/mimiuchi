#!/bin/bash

# Kill any existing processes on port 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start the dev server
echo "🚀 Starting mimiuchi development server..."
echo "📍 Web app will be available at: http://localhost:5173/"
echo "📍 Language streams:"
echo "   - http://localhost:5173/english"
echo "   - http://localhost:5173/spanish"
echo "   - http://localhost:5173/korean"
echo "   - http://localhost:5173/mandarin"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
