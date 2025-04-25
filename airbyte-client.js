/**
 * Airbyte Embedded API Client
 * This module provides functions to interact with the Airbyte API for implementing
 * the Airbyte Embedded solution.
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

class AirbyteClient {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'https://api.airbyte.com/v1';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = null;
    this.tokenExpiration = null;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken() {
    const now = new Date();
    
    // If we have a valid token that's not expired (with 30s buffer), use it
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date(now.getTime() + 30000)) {
      return this.accessToken;
    }
    
    // Otherwise, request a new token
    try {
      const fetch = await getFetch();
      const response = await fetch(`https://api.airbyte.com/v1/applications/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get access token: ${errorData.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      this.accessToken = data.access_token;
      
      // Token is valid for a limited time (usually a few minutes)
      this.tokenExpiration = new Date(now.getTime() + (data.expires_in || 180) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error fetching access token:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated request to the Airbyte API
   */
  async request(endpoint, method = 'GET', body = null) {
    try {
      const token = await this.getAccessToken();
      const fetch = await getFetch();
      
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AirbyteEmbeddedPOC/1.0'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const url = `${this.apiUrl}${endpoint}`;
      const response = await fetch(url, options);
      
      const data = await response.json();
      
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
    const sourceDefinitions = await this.request('/source_definitions');
    return sourceDefinitions.sourceDefinitions.find(def => 
      def.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  /**
   * Get destination definition by name
   */
  async getDestinationDefinitionByName(name) {
    const destinationDefinitions = await this.request('/destination_definitions');
    return destinationDefinitions.destinationDefinitions.find(def => 
      def.name.toLowerCase().includes(name.toLowerCase())
    );
  }
}

module.exports = AirbyteClient; 