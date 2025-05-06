# PMarena Recording Template

This is a custom recording template for LiveKit egress used by the PMarena application. It ensures that all participants (including those with cameras off) are visible in recordings, and properly displays screen shares.

## Features

- Shows participant tiles with identities even when cameras are off
- Properly handles screen shares in recordings
- Automatic layout switching based on content
- Custom styling to match the application theme

## Development

### Prerequisites

- Node.js 16+
- Yarn or npm

### Setup

```bash
npm install
# or
yarn
```

### Running locally

```bash
npm run start
# or
yarn start
```

### Building for production

```bash
npm run build
# or
yarn build
```

The build output will be in the `dist` directory and can be deployed to any static hosting service.

## Usage in LiveKit Egress

When starting a room recording, use the `custom_base_url` parameter with the URL where this template is hosted:

```typescript
egressClient.startRoomCompositeEgress(
  roomName,
  output,
  {
    layout: 'grid',
    custom_base_url: 'https://your-hosted-template-url',
  }
);
```

## LiveKit Documentation

For more information on custom recording templates, visit the [LiveKit documentation](https://docs.livekit.io/home/egress/custom-template/). 