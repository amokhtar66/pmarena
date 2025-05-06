# Testing the Recording Template Locally

To test the recording template locally before deployment, follow these steps:

## 1. Run the template locally

```bash
cd pmarena/frontend/template
npm install
npm run start
```

This will start a development server, usually at http://localhost:3030.

## 2. Open the template with test parameters

You can manually test the template by opening it in a browser with the right URL parameters. Create a URL with the following format:

```
http://localhost:3030/?url=<LIVEKIT_URL>&token=<TOKEN>&layout=grid
```

Where:
- `LIVEKIT_URL` is your LiveKit server URL (e.g., `wss://your-livekit-server.com`)
- `TOKEN` is a valid LiveKit token for joining a room as a recorder

## 3. Using LiveKit CLI for testing (recommended)

If you have the LiveKit CLI installed, you can use the `test-template` command:

```bash
lk egress test-template \
  --base-url http://localhost:3030 \
  --room YOUR_TEST_ROOM \
  --layout grid \
  --publishers 3
```

This will:
1. Create a test room
2. Add virtual publishers
3. Open a browser with your template using the correct parameters

## 4. What to look for

When testing, verify that:

1. The template loads correctly
2. Participants with cameras off show their identity information (not a black screen)
3. The "START_RECORDING" console log appears in the browser console
4. Screen shares are displayed properly when present
5. The layout adjusts correctly based on content

## Common Issues

- **CORS Errors**: If testing with a real LiveKit server, ensure your local development server allows CORS requests.
- **Authentication Errors**: Ensure your token has the necessary permissions.
- **Missing Console Logs**: Verify that `console.log('START_RECORDING')` is called after the room connects successfully. 