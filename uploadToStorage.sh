#!/bin/bash

# Helper script to upload WordPress images to Object Storage
# 
# Usage: 
#   1. Place your WordPress uploads folder in /tmp/wordpress-uploads/
#   2. Run: bash uploadToStorage.sh

BUCKET_ID="${DEFAULT_OBJECT_STORAGE_BUCKET_ID}"

echo "📦 Uploading to Object Storage..."
echo "Bucket: $BUCKET_ID"
echo ""

# Check if uploads folder exists
if [ ! -d "/tmp/wordpress-uploads" ]; then
  echo "❌ Error: /tmp/wordpress-uploads folder not found"
  echo "Please upload your WordPress uploads folder to /tmp/wordpress-uploads first"
  exit 1
fi

echo "⏳ This may take a while for 14GB..."
echo "Uploading files to public/uploads/..."

# Use gsutil or GCS SDK to upload
# This is a placeholder - Replit Object Storage has a specific upload method
# You'll need to use the Object Storage UI or API

echo "✅ Please use the Object Storage UI in Replit to upload your files"
echo "   1. Open Object Storage tool"
echo "   2. Navigate to 'public' folder"
echo "   3. Upload your WordPress uploads folder"
