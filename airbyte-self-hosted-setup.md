# Setting Up Airbyte Self-Hosted on Docker

This document provides step-by-step instructions for setting up Airbyte self-hosted on Docker locally and connecting it to the Airbyte POC application.

## Prerequisites

- Docker installed and running
- Node.js and npm installed
- Git (to clone the repository if needed)

## Installation Steps

### 1. Install the Airbyte CLI Tool (abctl)

The Airbyte CLI tool makes it easy to install and manage a self-hosted Airbyte instance.

```bash
curl -LsfS https://get.airbyte.com | bash -
```

This will install the `abctl` command-line tool, which we'll use to set up Airbyte.

### 2. Install Airbyte Locally

Use the `abctl` tool to install Airbyte locally:

```bash
abctl local install
```

This command will:
- Create a Kubernetes cluster using Kind
- Pull the necessary Docker images
- Install Airbyte using Helm
- Set up an ingress to make Airbyte accessible at http://localhost:8000

The installation might take several minutes to complete, depending on your internet connection and computer performance.

### 3. Get Airbyte Credentials

Once the installation is complete, retrieve the credentials for your Airbyte instance:

```bash
abctl local credentials
```

This will output credentials similar to:

```
INFO    Using Kubernetes provider:
          Provider: kind
          Kubeconfig: /Users/username/.airbyte/abctl/abctl.kubeconfig
          Context: kind-airbyte-abctl
SUCCESS  Retrieving your credentials from 'airbyte-auth-secrets'
INFO    Credentials:
          Email: [not set]
          Password: 32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7
          Client-Id: 68eb3177-2afb-44da-851d-a9deb0bb9364
          Client-Secret: AKS7gtga3Sw1HSRI65KtauGPPaeKf0Ju
```

Make note of these credentials as you'll need them to connect to Airbyte.

### 4. Update the Airbyte POC Application

#### 4.1. Update the .env File

Create or update the `.env` file in your Airbyte POC application directory with the following content:

```
# Airbyte Self-Hosted Credentials
AIRBYTE_CLIENT_ID=<your-client-id>
AIRBYTE_CLIENT_SECRET=<your-client-secret>
AIRBYTE_PASSWORD=<your-password>

# Callback URL for OAuth
CALLBACK_URL=http://localhost:3001/oauth/callback
```

Replace `<your-client-id>`, `<your-client-secret>`, and `<your-password>` with the values from the `abctl local credentials` command.

#### 4.2. Update the server.js File

Update the server.js file to use the self-hosted Airbyte instance:

1. Change the port to avoid conflicts:

```javascript
const app = express();
const port = process.env.PORT || 3001;
```

2. Update the Airbyte client configuration:

```javascript
// Get Airbyte API credentials from environment variables or use the ones from the local installation
const AIRBYTE_CLIENT_ID = process.env.AIRBYTE_CLIENT_ID || '<your-client-id>';
const AIRBYTE_CLIENT_SECRET = process.env.AIRBYTE_CLIENT_SECRET || '<your-client-secret>';
const AIRBYTE_PASSWORD = process.env.AIRBYTE_PASSWORD || '<your-password>';

console.log('Using self-hosted Airbyte instance at http://localhost:8000');

// Create an instance of our Airbyte client
const airbyteClient = new AirbyteClient({
  apiUrl: 'http://localhost:8000/api/v1',
  useBasicAuth: true,
  username: 'airbyte',
  password: AIRBYTE_PASSWORD
});
```

3. Remove the API credential checks in the source-definitions and destination-definitions endpoints:

```javascript
// No need to check for API credentials as we're using self-hosted Airbyte
```

#### 4.3. Ensure the Airbyte Client is Configured for Self-Hosted

The `airbyte-client.js` file should already be configured to work with a self-hosted Airbyte instance. It should include methods like:

```javascript
class AirbyteClient {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:8000/api/v1';
    this.useBasicAuth = config.useBasicAuth !== undefined ? config.useBasicAuth : false;
    this.username = config.username;
    this.password = config.password;
  }
  
  // ... other methods
}
```

### 5. Start the Airbyte POC Application

Install the dependencies and start the application:

```bash
npm install
npm start
```

The application should now be running on http://localhost:3001 and connected to your self-hosted Airbyte instance.

## Accessing the Applications

- **Airbyte UI**: http://localhost:8000
  - Username: airbyte
  - Password: <your-password>

- **Airbyte POC Application**: http://localhost:3001

## Troubleshooting

### Port Conflicts

If you encounter a port conflict (EADDRINUSE error), you can change the port in the server.js file:

```javascript
const port = process.env.PORT || 3001; // Change to another port if needed
```

Also, update the callback URL in the .env file:

```
CALLBACK_URL=http://localhost:3001/oauth/callback
```

### Connection Issues

If you have trouble connecting to Airbyte, make sure:

1. The Airbyte instance is running. You can check with:
   ```bash
   abctl local status
   ```

2. The credentials in the .env file match those from `abctl local credentials`

3. The Airbyte client is configured to use basic authentication with the correct username and password

## Stopping Airbyte

To stop the Airbyte instance when you're done:

```bash
abctl local stop
```

To completely uninstall Airbyte:

```bash
abctl local uninstall
```

## Additional Resources

- [Airbyte Documentation](https://docs.airbyte.com/)
- [Airbyte GitHub Repository](https://github.com/airbytehq/airbyte)
- [Airbyte CLI (abctl) Documentation](https://docs.airbyte.com/using-airbyte/abctl/)
