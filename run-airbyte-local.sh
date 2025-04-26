#!/bin/bash
set -e

# This script sets up a self-hosted Airbyte instance and updates the Airbyte POC
# to work with it on a machine that already has Docker installed.

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create a directory for Airbyte
echo "Setting up Airbyte..."
mkdir -p ~/airbyte
cd ~/airbyte

# Clone Airbyte repository
if [ ! -d ".git" ]; then
    echo "Cloning Airbyte repository..."
    git clone https://github.com/airbytehq/airbyte.git .
else
    echo "Airbyte repository already exists, pulling latest changes..."
    git pull
fi

# Start Airbyte
echo "Starting Airbyte..."
./run-ab-platform.sh &

# Wait for Airbyte to start
echo "Waiting for Airbyte to start (this may take a few minutes)..."
echo "You can check the status by visiting http://localhost:8000 in your browser."
sleep 30

# Return to the airbyte-poc directory
echo "Setting up Airbyte POC application..."
cd -

# Update the AirbyteClient.js file
echo "Updating AirbyteClient.js for self-hosted Airbyte..."
cat > airbyte-client.js << 'EOL'
/**
 * Airbyte Embedded API Client for Self-Hosted Airbyte
 * This module provides functions to interact with a self-hosted Airbyte API
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

class AirbyteClient {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:8000/api/v1';
    this.useBasicAuth = config.useBasicAuth !== undefined ? config.useBasicAuth : false;
    this.username = config.username;
    this.password = config.password;
  }

  /**
   * Make a request to the Airbyte API
   */
  async request(endpoint, method = 'GET', body = null) {
    try {
      const fetch = await getFetch();
      
      const options = {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AirbyteEmbeddedPOC/1.0'
        }
      };
      
      // Add basic auth if configured
      if (this.useBasicAuth && this.username && this.password) {
        const base64Credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        options.headers['Authorization'] = `Basic ${base64Credentials}`;
      }
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const url = `${this.apiUrl}${endpoint}`;
      console.log(`Making request to: ${url}`);
      const response = await fetch(url, options);
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'Unknown error',
          data
        };
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Create a workspace for a customer/user
   */
  async createWorkspace(name, email) {
    return this.request('/workspaces', 'POST', {
      name,
      email
    });
  }

  /**
   * List all workspaces
   */
  async listWorkspaces() {
    return this.request('/workspaces');
  }

  /**
   * Create a source with OAuth
   */
  async initiateOAuth(workspaceId, sourceDefinitionId, redirectUrl) {
    return this.request('/sources/initiate_oauth', 'POST', {
      workspaceId,
      sourceDefinitionId,
      redirectUrl
    });
  }

  /**
   * Complete OAuth and create a source
   */
  async completeOAuth(workspaceId, sourceDefinitionId, redirectUrl, queryParams, sourceName, oAuthInputConfiguration = {}) {
    return this.request('/sources/complete_oauth', 'POST', {
      workspaceId,
      sourceDefinitionId,
      redirectUrl,
      queryParams,
      sourceName,
      oAuthInputConfiguration
    });
  }

  /**
   * Create a destination
   */
  async createDestination(workspaceId, destinationDefinitionId, name, connectionConfiguration) {
    return this.request('/destinations', 'POST', {
      workspaceId,
      destinationDefinitionId,
      name,
      connectionConfiguration
    });
  }

  /**
   * Create a connection between a source and destination
   */
  async createConnection(sourceId, destinationId, name, config = {}) {
    const defaultConfig = {
      namespaceDefinition: "destination",
      namespaceFormat: "${SOURCE_NAMESPACE}",
      nonBreakingSchemaUpdatesBehavior: "ignore",
      schedule: { scheduleType: "manual" },
      dataResidency: "auto"
    };
    
    return this.request('/connections', 'POST', {
      ...defaultConfig,
      ...config,
      name,
      sourceId,
      destinationId
    });
  }

  /**
   * Trigger a sync job
   */
  async triggerSync(connectionId) {
    return this.request('/jobs', 'POST', {
      jobType: "sync",
      connectionId
    });
  }

  /**
   * Get source definition by name
   */
  async getSourceDefinitionByName(name) {
    try {
      // For self-hosted Airbyte, we need to use the workspace ID
      const workspaces = await this.listWorkspaces();
      if (!workspaces || !workspaces.workspaces || workspaces.workspaces.length === 0) {
        throw new Error('No workspaces found');
      }
      
      // Use the first workspace
      const workspaceId = workspaces.workspaces[0].workspaceId;
      
      // Get source definitions for this workspace
      const sourceDefinitions = await this.request(`/workspaces/${workspaceId}/source_definitions`);
      return sourceDefinitions.sourceDefinitions.find(def => 
        def.name.toLowerCase().includes(name.toLowerCase())
      );
    } catch (error) {
      console.error('Error getting source definition by name:', error);
      throw error;
    }
  }

  /**
   * Get destination definition by name
   */
  async getDestinationDefinitionByName(name) {
    try {
      // For self-hosted Airbyte, we need to use the workspace ID
      const workspaces = await this.listWorkspaces();
      if (!workspaces || !workspaces.workspaces || workspaces.workspaces.length === 0) {
        throw new Error('No workspaces found');
      }
      
      // Use the first workspace
      const workspaceId = workspaces.workspaces[0].workspaceId;
      
      // Get destination definitions for this workspace
      const destinationDefinitions = await this.request(`/workspaces/${workspaceId}/destination_definitions`);
      return destinationDefinitions.destinationDefinitions.find(def => 
        def.name.toLowerCase().includes(name.toLowerCase())
      );
    } catch (error) {
      console.error('Error getting destination definition by name:', error);
      throw error;
    }
  }
}

module.exports = AirbyteClient;
EOL

# Update server.js to use the self-hosted Airbyte instance
echo "Updating server.js to work with self-hosted Airbyte..."
sed -i 's|https://api.airbyte.com/v1|http://localhost:8000/api/v1|g' server.js

# Remove the client ID and secret requirements
sed -i 's|const AIRBYTE_CLIENT_ID = process.env.AIRBYTE_CLIENT_ID || .*|const AIRBYTE_CLIENT_ID = null; // Not needed for self-hosted|g' server.js
sed -i 's|const AIRBYTE_CLIENT_SECRET = process.env.AIRBYTE_CLIENT_SECRET || .*|const AIRBYTE_CLIENT_SECRET = null; // Not needed for self-hosted|g' server.js

# Update the AirbyteClient initialization
sed -i 's|const airbyteClient = new AirbyteClient({|const airbyteClient = new AirbyteClient({\n  // Using self-hosted Airbyte with no auth\n  useBasicAuth: false,|g' server.js

# Install dependencies
echo "Installing dependencies..."
npm install

# Start the application
echo "Starting the Airbyte POC application..."
npm start &

echo ""
echo "Setup complete!"
echo "Airbyte UI is available at: http://localhost:8000"
echo "Airbyte POC application is available at: http://localhost:3000"
echo ""
echo "You can now use the Airbyte POC application with your self-hosted Airbyte instance."
