<a href="https://livekit.io/">
  <img src="./.github/assets/livekit-mark.png" alt="LiveKit logo" width="100" height="100">
</a>

# Node.js Multimodal Voice Agent

# ProductGym Backend Agent

This backend agent integrates with LiveKit and handles AI voice interviews.

## New Recording Functionality

The agent now automatically starts recording when a participant joins the room. This implements LiveKit's recommended approach for recording conversations as described in their [documentation](https://docs.livekit.io/agents/v0/build/record/).

Key features:
- Recordings start automatically when a participant joins
- MP4 video files are saved with a speaker layout
- Recording information is stored in Supabase for tracking

## Setup

1. Install dependencies:
```bash
npm install
# or with pnpm
pnpm install
```

2. Create a `.env` file with the following variables:
```
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=your_livekit_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Build the TypeScript code:
```bash
npm run build
# or with pnpm
pnpm build
```

4. Start the agent:
```bash
npm run start
# or with pnpm
pnpm start
```

## Development

For development with automatic reloading:
```bash
npm run dev
# or with pnpm
pnpm dev
```

<p>
  <a href="https://cloud.livekit.io/projects/p_/sandbox"><strong>Deploy a sandbox app</strong></a>
  •
  <a href="https://docs.livekit.io/agents/overview/">LiveKit Agents Docs</a>
  •
  <a href="https://livekit.io/cloud">LiveKit Cloud</a>
  •
  <a href="https://blog.livekit.io/">Blog</a>
</p>

A basic example of a multimodal voice agent using LiveKit and the Node.js [Agents Framework](https://github.com/livekit/agents-js).

## Dev Setup

Clone the repository and install dependencies:

```bash
pnpm install
```

Set up the environment by copying `.env.example` to `.env.local` and filling in the required values:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`

You can also do this automatically using the LiveKit CLI:

```bash
lk app env
```

To run the agent, first build the TypeScript project, then execute the output with the `dev` or `start` commands:
    
```bash
pnpm build
node dist/agent.js dev # see agents-js for more info on subcommands
```

This agent requires a frontend application to communicate with. You can use one of our example frontends in [livekit-examples](https://github.com/livekit-examples/), create your own following one of our [client quickstarts](https://docs.livekit.io/realtime/quickstarts/), or test instantly against one of our hosted [Sandbox](https://cloud.livekit.io/projects/p_/sandbox) frontends.
