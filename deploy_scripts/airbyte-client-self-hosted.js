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
