/**
 * OAuth Proxy Server for AirBike
 * This proxy server forwards OAuth requests to the AirBike platform without authentication
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');

const app = express();
const port = 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Create a direct route for testing OAuth
app.post('/direct-oauth-test', async (req, res) => {
  console.log('Received direct OAuth test request');

  try {
    // Create the request options
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/source_oauths/get_consent_url',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Create the request
    const request = http.request(options, (response) => {
      console.log(`Direct OAuth test response status: ${response.statusCode}`);

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log('Response data:', data);
        res.status(response.statusCode).send(data);
      });
    });

    request.on('error', (error) => {
      console.error('Direct OAuth test error:', error);
      res.status(500).json({ error: 'Request failed', message: error.message });
    });

    // Send the request body
    const requestBody = JSON.stringify(req.body);
    console.log('Sending request body:', requestBody);
    request.write(requestBody);
    request.end();
  } catch (error) {
    console.error('Error in direct OAuth test:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Create a proxy for OAuth endpoints
const oauthProxy = createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // Remove the /proxy prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    // Try without authentication
    // We'll let the server handle the request without auth
    // This is a workaround for the OAuth endpoints

    // Log the request for debugging
    console.log(`Proxying request to: ${req.method} ${proxyReq.path}`);
    console.log('Request headers:', proxyReq.getHeaders());

    // If the request has a body, make sure it's properly forwarded
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      console.log('Request body:', bodyData);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response for debugging
    console.log(`Received response from AirBike: ${proxyRes.statusCode}`);
    console.log('Response headers:', proxyRes.headers);

    // Log the response body
    let responseBody = '';
    proxyRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    proxyRes.on('end', () => {
      console.log('Response body:', responseBody);
    });
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
});

// Use the proxy for all OAuth-related endpoints
app.use('/proxy/api/v1/source_oauths', oauthProxy);
app.use('/proxy/api/v1/destination_oauths', oauthProxy);

// Test with a valid workspace ID
app.post('/test-with-valid-workspace', async (req, res) => {
  console.log('Received test with valid workspace request');

  try {
    // Create a request with a valid workspace ID
    const validRequest = {
      sourceDefinitionId: req.body.sourceDefinitionId || "36c891d9-4bd9-43ac-bad2-10e12756272c",
      workspaceId: "4fa87658-8ced-45d0-979e-30edc0c4a494", // This is a valid workspace ID from the AirBike platform
      redirectUrl: req.body.redirectUrl || "http://localhost:3003/oauth/callback",
      oauthInputConfiguration: req.body.oauthInputConfiguration || {
        scopes: [
          "crm.objects.contacts.read",
          "crm.objects.companies.read",
          "crm.objects.deals.read"
        ]
      }
    };

    // Create the request options
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/source_oauths/get_consent_url',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Create the request
    const request = http.request(options, (response) => {
      console.log(`Valid workspace test response status: ${response.statusCode}`);

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log('Response data:', data);
        res.status(response.statusCode).send(data);
      });
    });

    request.on('error', (error) => {
      console.error('Valid workspace test error:', error);
      res.status(500).json({ error: 'Request failed', message: error.message });
    });

    // Send the request body
    const requestBody = JSON.stringify(validRequest);
    console.log('Sending request body with valid workspace:', requestBody);
    request.write(requestBody);
    request.end();
  } catch (error) {
    console.error('Error in valid workspace test:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  console.log(`OAuth Proxy Server running on http://localhost:${port}`);
  console.log(`Use http://localhost:${port}/proxy/api/v1/source_oauths/get_consent_url for OAuth requests`);
  console.log(`Or use http://localhost:${port}/direct-oauth-test for direct testing`);
  console.log(`Or use http://localhost:${port}/test-with-valid-workspace for testing with a valid workspace ID`);
});
