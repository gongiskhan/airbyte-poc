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
    // Use the correct API path for OSS users
    this.apiUrl = config.apiUrl || 'http://scuver.services:8000/api/public/v1';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.email = config.email || 'goncalo.p.gomes@gmail.com';
    this.password = config.password || '32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7';

    // Use a hardcoded token for testing
    this.accessToken = config.token;
    this.tokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours from now
  }

  /**
   * Get an authentication token
   */
  async getAuthToken() {
    try {
      // For self-hosted Airbyte, we'll generate a new token for each request
      // This ensures we always have a fresh token
      console.log('Generating a new token for this request');

      // Generate a new token using the Airbyte API
      const token = await this.generateToken();

      if (token) {
        this.accessToken = token;
        // Set token expiry to 2 minutes from now (shorter than the 3 minute limit)
        this.tokenExpiry = new Date(Date.now() + (2 * 60 * 1000));
        return token;
      }

      // If we have an existing token, use it as fallback
      if (this.accessToken) {
        console.log('Using existing token as fallback');
        return this.accessToken;
      }

      console.log('No token available. Using credentials-based authentication.');
      return null;
    } catch (error) {
      console.error('Error getting authentication token:', error);
      // If token generation fails, try to proceed without a token
      console.log('Proceeding without authentication token due to error');
      return null;
    }
  }

  /**
   * Generate a new token using the Airbyte API
   * This is a simplified implementation - in production you would use the proper Airbyte auth endpoints
   */
  async generateToken() {
    try {
      const fetch = await getFetch();

      // For self-hosted Airbyte, we can use basic auth to get a token
      // This is a simplified approach - in production you would use the proper Airbyte auth endpoints
      // Use the base URL with the correct path for authentication
      const baseUrl = this.apiUrl.substring(0, this.apiUrl.indexOf('/api/'));
      const authUrl = `${baseUrl}/api/public/v1/auth/login`;

      const options = {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password
        })
      };

      console.log(`Requesting new token from: ${authUrl}`);
      const response = await fetch(authUrl, options);

      if (!response.ok) {
        console.error('Failed to generate token:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('Successfully generated new token');

      return data.token || data.access_token || null;
    } catch (error) {
      console.error('Error generating token:', error);
      return null;
    }
  }

  /**
   * Make a request to the Airbyte API
   */
  async request(endpoint, method = 'GET', body = null) {
    try {
      const fetch = await getFetch();

      // Check if this is an OAuth-related endpoint
      const isOAuthEndpoint = endpoint.includes('oauth');

      // Always try to get a fresh token for each request
      let token;
      try {
        token = await this.getAuthToken();
      } catch (authError) {
        console.warn('Failed to get auth token, proceeding without authentication:', authError.message);
      }

      const options = {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AirbyteEmbeddedPOC/1.0'
        }
      };

      // Use Bearer token authentication with the fresh token if available
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
        console.log('Using fresh Bearer token from getAuthToken');
      } else if (this.accessToken) {
        // Fallback to the stored token if no fresh token is available
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;
        console.log('Using stored Bearer token as fallback');
      } else if (this.email && this.password) {
        // Fallback to basic auth if we have credentials
        const base64Credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
        options.headers['Authorization'] = `Basic ${base64Credentials}`;
        console.log('Using Basic authentication as fallback');
      } else {
        console.log('No authentication credentials available, proceeding without authentication');
      }

      if (body) {
        options.body = JSON.stringify(body);
      }

      const url = `${this.apiUrl}${endpoint}`;
      console.log(`Making request to: ${url}`);

      // For OAuth endpoints, try multiple authentication methods if needed
      if (isOAuthEndpoint) {
        console.log('OAuth endpoint detected, will try multiple authentication methods if needed');

        // First attempt with current authentication
        let response = await fetch(url, options);

        // If unauthorized, try with basic auth
        if (response.status === 401 && this.email && this.password) {
          console.log('OAuth endpoint returned 401, trying with basic auth...');
          const basicAuthOptions = { ...options };
          const base64Credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
          basicAuthOptions.headers['Authorization'] = `Basic ${base64Credentials}`;

          response = await fetch(url, basicAuthOptions);

          // If still unauthorized, try without authentication
          if (response.status === 401) {
            console.log('OAuth endpoint still unauthorized with basic auth, trying without authentication...');
            const noAuthOptions = { ...options };
            delete noAuthOptions.headers['Authorization'];

            response = await fetch(url, noAuthOptions);
          }
        }

        return this.processResponse(response, url);
      }

      // For non-OAuth endpoints, use standard approach with token refresh
      let response = await fetch(url, options);

      // If we get a 401 Unauthorized, try to refresh the token and retry once
      if (response.status === 401) {
        console.log('Received 401 Unauthorized, attempting to refresh token and retry...');

        // Force token refresh by clearing the current token
        this.accessToken = null;
        this.tokenExpiry = null;

        // Get a fresh token
        const newToken = await this.generateToken();

        if (newToken) {
          console.log('Successfully refreshed token, retrying request');
          this.accessToken = newToken;
          options.headers['Authorization'] = `Bearer ${newToken}`;

          // Retry the request with the new token
          response = await fetch(url, options);
        } else if (this.email && this.password) {
          // If token refresh fails, try basic auth as a last resort
          console.log('Token refresh failed, trying basic auth as last resort');
          const base64Credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
          options.headers['Authorization'] = `Basic ${base64Credentials}`;

          // Retry with basic auth
          response = await fetch(url, options);
        }
      }

      return this.processResponse(response, url);
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Process an API response
   */
  async processResponse(response, url) {
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      console.log(`Full error response from ${url}:`, JSON.stringify(data, null, 2));
      throw {
        status: response.status,
        message: data.message || 'Unknown error',
        data
      };
    }

    return data;
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
    try {
      console.log('Attempting to list workspaces...');
      const response = await this.request('/workspaces');
      console.log('Workspaces response:', JSON.stringify(response, null, 2));

      // Check if the response has the expected structure
      if (response && response.data && Array.isArray(response.data)) {
        // Convert the response format to match what our code expects
        console.log(`Found ${response.data.length} workspaces`);
        return {
          workspaces: response.data.map(workspace => ({
            workspaceId: workspace.workspaceId,
            name: workspace.name,
            // Include other properties as needed
            dataResidency: workspace.dataResidency
          }))
        };
      } else if (!response || !response.workspaces) {
        console.warn('Unexpected workspaces response format:', response);
        // Return an empty workspaces array instead of failing
        return { workspaces: [] };
      }

      return response;
    } catch (error) {
      console.error('Error listing workspaces:', error);
      // Return an empty workspaces array instead of propagating the error
      return { workspaces: [] };
    }
  }

  /**
   * Create a source with OAuth
   */
  async initiateOAuth(workspaceId, sourceDefinitionId, redirectUrl) {
    try {
      console.log(`Initiating OAuth flow for workspace ${workspaceId}, source definition ${sourceDefinitionId}, and redirect URL ${redirectUrl}`);

      // Try multiple endpoint formats for OAuth initiation
      let response;
      let error;

      // Attempt 1: Try the standard endpoint format
      try {
        console.log('Attempting OAuth initiation with standard endpoint format...');
        response = await this.request('/sources/initiate_oauth', 'POST', {
          workspaceId,
          sourceDefinitionId,
          redirectUrl,
          oauthInputConfiguration: {
            // These are the minimum scopes needed for HubSpot
            scopes: [
              "crm.objects.contacts.read",
              "crm.objects.companies.read",
              "crm.objects.deals.read",
              "crm.schemas.deals.read",
              "crm.schemas.companies.read",
              "content",
              "crm.lists.read",
              "forms",
              "tickets",
              "e-commerce",
              "sales-email-read",
              "automation"
            ]
          }
        });
      } catch (err1) {
        console.log('Standard endpoint format failed:', err1.message);
        error = err1;

        // Attempt 2: Try the v1 endpoint format
        try {
          console.log('Attempting OAuth initiation with v1 endpoint format...');
          response = await this.request('/v1/sources/initiate_oauth', 'POST', {
            workspaceId,
            sourceDefinitionId,
            redirectUrl,
            oauthInputConfiguration: {
              scopes: [
                "crm.objects.contacts.read",
                "crm.objects.companies.read",
                "crm.objects.deals.read",
                "crm.schemas.deals.read",
                "crm.schemas.companies.read",
                "content",
                "crm.lists.read",
                "forms",
                "tickets",
                "e-commerce",
                "sales-email-read",
                "automation"
              ]
            }
          });
        } catch (err2) {
          console.log('v1 endpoint format failed:', err2.message);

          // Attempt 3: Try the workspace-specific endpoint format
          try {
            console.log('Attempting OAuth initiation with workspace-specific endpoint format...');
            response = await this.request(`/workspaces/${workspaceId}/sources/initiate_oauth`, 'POST', {
              sourceDefinitionId,
              redirectUrl,
              oauthInputConfiguration: {
                scopes: [
                  "crm.objects.contacts.read",
                  "crm.objects.companies.read",
                  "crm.objects.deals.read",
                  "crm.schemas.deals.read",
                  "crm.schemas.companies.read",
                  "content",
                  "crm.lists.read",
                  "forms",
                  "tickets",
                  "e-commerce",
                  "sales-email-read",
                  "automation"
                ]
              }
            });
          } catch (err3) {
            console.log('Workspace-specific endpoint format failed:', err3.message);

            // Attempt 4: Try the connector-specific endpoint format
            try {
              console.log('Attempting OAuth initiation with connector-specific endpoint format...');
              response = await this.request(`/source_definitions/${sourceDefinitionId}/oauth/parameter_specifications`, 'GET');

              // If we get the parameter specifications, use them to initiate OAuth
              if (response) {
                console.log('Got parameter specifications, initiating OAuth with connector-specific endpoint...');
                response = await this.request(`/source_definitions/${sourceDefinitionId}/oauth/consent_url`, 'POST', {
                  workspaceId,
                  redirectUrl,
                  oauthInputConfiguration: {
                    scopes: [
                      "crm.objects.contacts.read",
                      "crm.objects.companies.read",
                      "crm.objects.deals.read",
                      "crm.schemas.deals.read",
                      "crm.schemas.companies.read",
                      "content",
                      "crm.lists.read",
                      "forms",
                      "tickets",
                      "e-commerce",
                      "sales-email-read",
                      "automation"
                    ]
                  }
                });
              }
            } catch (err4) {
              console.log('Connector-specific endpoint format failed:', err4.message);

              // If all attempts fail, throw the original error
              throw error;
            }
          }
        }
      }

      console.log('OAuth initiation response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Error initiating OAuth:', error);

      // Provide more detailed error information
      if (error.status === 403) {
        console.error('Forbidden error. This could be due to missing permissions or incorrect OAuth configuration.');
        console.error('Please ensure your HubSpot account has the necessary permissions and your OAuth app is properly configured.');
      }

      throw error;
    }
  }

  /**
   * Complete OAuth and create a source
   */
  async completeOAuth(workspaceId, sourceDefinitionId, redirectUrl, queryParams, sourceName, oAuthInputConfiguration = {}) {
    try {
      console.log(`Completing OAuth flow for workspace ${workspaceId}, source definition ${sourceDefinitionId}`);
      console.log(`Query params:`, JSON.stringify(queryParams, null, 2));

      // For HubSpot, we need to ensure we have the correct configuration
      // Merge any provided configuration with defaults for HubSpot
      const hubspotConfig = {
        ...oAuthInputConfiguration,
        // Add any default configuration needed for HubSpot
        start_date: oAuthInputConfiguration.start_date || new Date().toISOString().split('T')[0]
      };

      // Try multiple endpoint formats for OAuth completion
      let response;
      let error;

      // Attempt 1: Try the standard endpoint format
      try {
        console.log('Attempting OAuth completion with standard endpoint format...');
        response = await this.request('/sources/complete_oauth', 'POST', {
          workspaceId,
          sourceDefinitionId,
          redirectUrl,
          queryParams,
          sourceName,
          oAuthInputConfiguration: hubspotConfig
        });
      } catch (err1) {
        console.log('Standard endpoint format failed:', err1.message);
        error = err1;

        // Attempt 2: Try the v1 endpoint format
        try {
          console.log('Attempting OAuth completion with v1 endpoint format...');
          response = await this.request('/v1/sources/complete_oauth', 'POST', {
            workspaceId,
            sourceDefinitionId,
            redirectUrl,
            queryParams,
            sourceName,
            oAuthInputConfiguration: hubspotConfig
          });
        } catch (err2) {
          console.log('v1 endpoint format failed:', err2.message);

          // Attempt 3: Try the workspace-specific endpoint format
          try {
            console.log('Attempting OAuth completion with workspace-specific endpoint format...');
            response = await this.request(`/workspaces/${workspaceId}/sources/complete_oauth`, 'POST', {
              sourceDefinitionId,
              redirectUrl,
              queryParams,
              sourceName,
              oAuthInputConfiguration: hubspotConfig
            });
          } catch (err3) {
            console.log('Workspace-specific endpoint format failed:', err3.message);

            // Attempt 4: Try the connector-specific endpoint format
            try {
              console.log('Attempting OAuth completion with connector-specific endpoint format...');
              response = await this.request(`/source_definitions/${sourceDefinitionId}/oauth/complete`, 'POST', {
                workspaceId,
                redirectUrl,
                queryParams,
                oAuthInputConfiguration: hubspotConfig
              });

              // If we get a successful response, create the source
              if (response) {
                console.log('OAuth completion successful, creating source...');

                // Create the source configuration
                const sourceConfig = {
                  ...hubspotConfig,
                  credentials: {
                    credentials_title: "OAuth Credentials",
                    ...response
                  }
                };

                // Create the source
                response = await this.createSource(
                  workspaceId,
                  sourceDefinitionId,
                  sourceName,
                  sourceConfig
                );
              }
            } catch (err4) {
              console.log('Connector-specific endpoint format failed:', err4.message);

              // If all attempts fail, try to create the source directly with the OAuth code
              try {
                console.log('All OAuth completion attempts failed, trying to create source directly...');

                // For HubSpot, create a source configuration with the OAuth code
                if (sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c' && queryParams.code) {
                  console.log('Creating HubSpot source directly with OAuth code...');

                  // Create a source configuration with the OAuth code
                  const sourceConfig = {
                    credentials: {
                      credentials_title: "OAuth Credentials",
                      oauth_code: queryParams.code,
                      redirect_uri: redirectUrl
                    },
                    start_date: hubspotConfig.start_date
                  };

                  // Create the source
                  response = await this.createSource(
                    workspaceId,
                    sourceDefinitionId,
                    sourceName,
                    sourceConfig
                  );
                } else {
                  // If we can't create the source directly, throw the original error
                  throw error;
                }
              } catch (err5) {
                console.log('Direct source creation failed:', err5.message);
                throw error;
              }
            }
          }
        }
      }

      console.log('OAuth completion response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Error completing OAuth:', error);

      // Provide more detailed error information
      if (error.status === 403) {
        console.error('Forbidden error. This could be due to missing permissions or incorrect OAuth configuration.');
        console.error('Please ensure your HubSpot account has the necessary permissions and your OAuth app is properly configured.');
      } else if (error.status === 400) {
        console.error('Bad request error. This could be due to invalid parameters or configuration.');
        console.error('Error details:', JSON.stringify(error.data || {}, null, 2));
      }

      throw error;
    }
  }

  /**
   * Create a source
   */
  async createSource(workspaceId, sourceDefinitionId, name, connectionConfiguration) {
    try {
      console.log(`Creating source in workspace ${workspaceId} with definition ${sourceDefinitionId}`);
      console.log('Connection configuration:', JSON.stringify(connectionConfiguration, null, 2));

      const response = await this.request('/sources', 'POST', {
        workspaceId,
        sourceDefinitionId,
        name,
        connectionConfiguration
      });

      console.log(`Successfully created source with ID: ${response.sourceId}`);
      return response;
    } catch (error) {
      console.error('Error creating source:', error);

      // Provide more detailed error information
      if (error.status === 400) {
        console.error('Bad request error. This could be due to invalid configuration parameters.');
        console.error('Error details:', JSON.stringify(error.data || {}, null, 2));
      } else if (error.status === 403) {
        console.error('Forbidden error. This could be due to missing permissions.');
      }

      throw error;
    }
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
      console.log(`Searching for source definition with name: ${name}`);

      // For self-hosted Airbyte, try different approaches

      // Approach 1: Try to get all source definitions directly (works in some self-hosted setups)
      try {
        console.log('Attempting to get all source definitions directly...');
        const allSourceDefinitions = await this.request('/source_definitions');

        if (allSourceDefinitions && allSourceDefinitions.sourceDefinitions) {
          console.log(`Found ${allSourceDefinitions.sourceDefinitions.length} source definitions`);

          const matchingDefinition = allSourceDefinitions.sourceDefinitions.find(def =>
            def.name.toLowerCase().includes(name.toLowerCase())
          );

          if (matchingDefinition) {
            console.log(`Found matching source definition: ${matchingDefinition.name} (${matchingDefinition.sourceDefinitionId})`);
            return matchingDefinition;
          } else {
            console.log(`No matching source definition found for: ${name} in global definitions`);
          }
        }
      } catch (directError) {
        console.log('Could not get source definitions directly:', directError.message);
      }

      // Approach 2: Try to get workspaces and then source definitions
      console.log('Trying to get source definitions through workspaces...');
      const workspaces = await this.listWorkspaces();

      if (workspaces.workspaces && workspaces.workspaces.length > 0) {
        // Use the first workspace
        const workspaceId = workspaces.workspaces[0].workspaceId;
        console.log(`Using workspace ID: ${workspaceId}`);

        try {
          // Get source definitions for this workspace
          const sourceDefinitions = await this.request(`/workspaces/${workspaceId}/source_definitions`);

          if (sourceDefinitions && sourceDefinitions.sourceDefinitions) {
            console.log(`Found ${sourceDefinitions.sourceDefinitions.length} source definitions in workspace`);

            const matchingDefinition = sourceDefinitions.sourceDefinitions.find(def =>
              def.name.toLowerCase().includes(name.toLowerCase())
            );

            if (matchingDefinition) {
              console.log(`Found matching source definition: ${matchingDefinition.name} (${matchingDefinition.sourceDefinitionId})`);
              return matchingDefinition;
            } else {
              console.log(`No matching source definition found for: ${name} in workspace`);
            }
          }
        } catch (workspaceError) {
          console.log(`Error getting source definitions for workspace ${workspaceId}:`, workspaceError.message);
        }
      } else {
        console.log('No workspaces found, trying to create one...');

        // Try to create a workspace
        try {
          const newWorkspace = await this.createWorkspace('Default Workspace', 'admin@example.com');
          console.log('Created new workspace:', newWorkspace);

          if (newWorkspace && newWorkspace.workspaceId) {
            // Try to get source definitions for the new workspace
            const sourceDefinitions = await this.request(`/workspaces/${newWorkspace.workspaceId}/source_definitions`);

            if (sourceDefinitions && sourceDefinitions.sourceDefinitions) {
              console.log(`Found ${sourceDefinitions.sourceDefinitions.length} source definitions in new workspace`);

              const matchingDefinition = sourceDefinitions.sourceDefinitions.find(def =>
                def.name.toLowerCase().includes(name.toLowerCase())
              );

              if (matchingDefinition) {
                console.log(`Found matching source definition: ${matchingDefinition.name} (${matchingDefinition.sourceDefinitionId})`);
                return matchingDefinition;
              }
            }
          }
        } catch (createError) {
          console.log('Failed to create workspace:', createError.message);
        }
      }

      // Approach 3: Try to use hardcoded values for common sources
      console.log('Trying to use hardcoded values for common sources...');
      const commonSources = {
        'hubspot': '36c891d9-4bd9-43ac-bad2-10e12756272c',
        'postgres': 'decd338e-5647-4c0b-adf4-da0e75f5a750',
        'mysql': '435bb9a5-7887-4809-aa58-28c27df0d7ad',
        'google sheets': '71607ba1-c0ac-4799-8049-7f4b90dd50f7',
        'file': '778daa7c-feaf-4db6-96f3-70fd645acc77',
        'stripe': 'e3cb2095-f5ef-4c9c-94a1-69e8f7fa2dfe',
        'salesforce': '2470e835-feaf-4db6-96f3-70fd645acc77',
        'shopify': '9da77001-af33-4bcd-be46-6252bf9342b9'
      };

      const lowerName = name.toLowerCase();
      for (const [sourceName, sourceId] of Object.entries(commonSources)) {
        if (lowerName.includes(sourceName)) {
          console.log(`Using hardcoded source definition ID for ${sourceName}: ${sourceId}`);
          return {
            sourceDefinitionId: sourceId,
            name: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
            dockerRepository: `airbyte/${sourceName}`,
            dockerImageTag: 'latest',
            documentationUrl: `https://docs.airbyte.com/integrations/sources/${sourceName}`
          };
        }
      }

      console.log(`Could not find source definition for: ${name} using any method`);
      return null;
    } catch (error) {
      console.error('Error getting source definition by name:', error);
      // Return null instead of throwing to avoid breaking the application
      return null;
    }
  }

  /**
   * Get destination definition by name
   */
  async getDestinationDefinitionByName(name) {
    try {
      console.log(`Searching for destination definition with name: ${name}`);

      // For self-hosted Airbyte, try different approaches

      // Approach 1: Try to get all destination definitions directly
      try {
        console.log('Attempting to get all destination definitions directly...');
        const allDestinationDefinitions = await this.request('/destination_definitions');

        if (allDestinationDefinitions && allDestinationDefinitions.destinationDefinitions) {
          console.log(`Found ${allDestinationDefinitions.destinationDefinitions.length} destination definitions`);

          const matchingDefinition = allDestinationDefinitions.destinationDefinitions.find(def =>
            def.name.toLowerCase().includes(name.toLowerCase())
          );

          if (matchingDefinition) {
            console.log(`Found matching destination definition: ${matchingDefinition.name} (${matchingDefinition.destinationDefinitionId})`);
            return matchingDefinition;
          } else {
            console.log(`No matching destination definition found for: ${name} in global definitions`);
          }
        }
      } catch (directError) {
        console.log('Could not get destination definitions directly:', directError.message);
      }

      // Approach 2: Try to get workspaces and then destination definitions
      console.log('Trying to get destination definitions through workspaces...');
      const workspaces = await this.listWorkspaces();

      if (workspaces.workspaces && workspaces.workspaces.length > 0) {
        // Use the first workspace
        const workspaceId = workspaces.workspaces[0].workspaceId;
        console.log(`Using workspace ID: ${workspaceId}`);

        try {
          // Get destination definitions for this workspace
          const destinationDefinitions = await this.request(`/workspaces/${workspaceId}/destination_definitions`);

          if (destinationDefinitions && destinationDefinitions.destinationDefinitions) {
            console.log(`Found ${destinationDefinitions.destinationDefinitions.length} destination definitions in workspace`);

            const matchingDefinition = destinationDefinitions.destinationDefinitions.find(def =>
              def.name.toLowerCase().includes(name.toLowerCase())
            );

            if (matchingDefinition) {
              console.log(`Found matching destination definition: ${matchingDefinition.name} (${matchingDefinition.destinationDefinitionId})`);
              return matchingDefinition;
            } else {
              console.log(`No matching destination definition found for: ${name} in workspace`);
            }
          }
        } catch (workspaceError) {
          console.log(`Error getting destination definitions for workspace ${workspaceId}:`, workspaceError.message);
        }
      } else {
        console.log('No workspaces found, trying to create one...');

        // Try to create a workspace
        try {
          const newWorkspace = await this.createWorkspace('Default Workspace', 'admin@example.com');
          console.log('Created new workspace:', newWorkspace);

          if (newWorkspace && newWorkspace.workspaceId) {
            // Try to get destination definitions for the new workspace
            const destinationDefinitions = await this.request(`/workspaces/${newWorkspace.workspaceId}/destination_definitions`);

            if (destinationDefinitions && destinationDefinitions.destinationDefinitions) {
              console.log(`Found ${destinationDefinitions.destinationDefinitions.length} destination definitions in new workspace`);

              const matchingDefinition = destinationDefinitions.destinationDefinitions.find(def =>
                def.name.toLowerCase().includes(name.toLowerCase())
              );

              if (matchingDefinition) {
                console.log(`Found matching destination definition: ${matchingDefinition.name} (${matchingDefinition.destinationDefinitionId})`);
                return matchingDefinition;
              }
            }
          }
        } catch (createError) {
          console.log('Failed to create workspace:', createError.message);
        }
      }

      // Approach 3: Try to use hardcoded values for common destinations
      console.log('Trying to use hardcoded values for common destinations...');
      const commonDestinations = {
        'postgres': '25c5221d-dce2-4163-ade9-739ef790f503',
        'mysql': '484ecb0e-e34c-43b9-b707-9f7107f0a091',
        'bigquery': '22f6c74f-5699-40ff-833c-4a879ea40133',
        'snowflake': '424892c4-daac-4491-b35d-c6688ba547ba',
        'redshift': 'f7a7d195-377f-cf5b-70a5-be6b77c932b6',
        's3': '4816b78f-1489-44c1-9060-4b19d5fa9362',
        'local json': '8be1cf83-fde1-477f-a4ad-318d23c9f3c6',
        'local csv': '8be1cf83-fde1-477f-a4ad-318d23c9f3c6'
      };

      const lowerName = name.toLowerCase();
      for (const [destName, destId] of Object.entries(commonDestinations)) {
        if (lowerName.includes(destName)) {
          console.log(`Using hardcoded destination definition ID for ${destName}: ${destId}`);
          return {
            destinationDefinitionId: destId,
            name: destName.charAt(0).toUpperCase() + destName.slice(1),
            dockerRepository: `airbyte/${destName}`,
            dockerImageTag: 'latest',
            documentationUrl: `https://docs.airbyte.com/integrations/destinations/${destName.replace(' ', '-')}`
          };
        }
      }

      console.log(`Could not find destination definition for: ${name} using any method`);
      return null;
    } catch (error) {
      console.error('Error getting destination definition by name:', error);
      // Return null instead of throwing to avoid breaking the application
      return null;
    }
  }
}

module.exports = AirbyteClient;
