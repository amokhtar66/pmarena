import { useEffect, useState } from 'react';
import { Room as LiveKitRoom } from 'livekit-client';
import { RoomProps } from './types';
import Room from './Room';
import './App.css';

export default function App() {
  const [roomProps, setRoomProps] = useState<RoomProps | null>(null);

  useEffect(() => {
    // Parse URL query parameters
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get('url');
    const token = params.get('token');
    const layout = params.get('layout') || 'grid';

    if (!serverUrl || !token) {
      console.error('Missing required parameters: url and token');
      return;
    }

    setRoomProps({
      serverUrl,
      token,
      layout,
    });
  }, []);

  if (!roomProps) {
    return <div className="loading">Loading...</div>;
  }

  return <Room {...roomProps} />;
} 