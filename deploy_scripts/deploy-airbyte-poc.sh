#!/bin/bash
set -e

# Clone Airbyte repository and start it
echo "Setting up self-hosted Airbyte..."
git clone https://github.com/airbytehq/airbyte.git
cd airbyte
./run-ab-platform.sh

# Wait for Airbyte to start
echo "Waiting for Airbyte to start (this may take a few minutes)..."
sleep 60

# Clone the Airbyte POC repository
echo "Setting up Airbyte POC application..."
cd /opt
git clone https://github.com/gongiskhan/airbyte-poc.git
cd airbyte-poc

# Update server.js to point to the self-hosted Airbyte instance
sed -i 's|https://api.airbyte.com/v1|http://localhost:8000/api/v1|g' server.js
sed -i 's|const AIRBYTE_CLIENT_ID = process.env.AIRBYTE_CLIENT_ID;|// No client ID needed for self-hosted\nconst AIRBYTE_CLIENT_ID = null;|g' server.js
sed -i 's|const AIRBYTE_CLIENT_SECRET = process.env.AIRBYTE_CLIENT_SECRET;|// No client secret needed for self-hosted\nconst AIRBYTE_CLIENT_SECRET = null;|g' server.js

# Update the AirbyteClient initialization
sed -i 's|const airbyteClient = new AirbyteClient({|const airbyteClient = new AirbyteClient({\n  // Using self-hosted Airbyte with no auth\n  useBasicAuth: false,|g' server.js

# Install dependencies and start the application
npm install
npm start
