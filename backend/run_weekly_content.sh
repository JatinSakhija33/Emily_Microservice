#!/bin/bash

# Weekly Content Generation Cron Job
# Runs every Sunday at 3:30 AM IST

# Set the working directory to the backend folder
cd /Users/macbookpro/Desktop/Emily1.0/backend

# Activate virtual environment
source venv/bin/activate

# Set environment variables (if not already set)
export PYTHONPATH="/Users/macbookpro/Desktop/Emily1.0/backend:$PYTHONPATH"

# Run the weekly content generation
python3 cron_weekly_content.py

# Log the completion
echo "Weekly content generation completed at $(date)"
