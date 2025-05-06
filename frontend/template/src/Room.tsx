import { useEffect, useState } from 'react';
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  VideoRenderer,
} from '@livekit/components-react';
import { 
  Room as LivekitRoom, 
  RoomEvent, 
  Track, 
  TrackPublication, 
  Participant,
  ConnectionState
} from 'livekit-client';
import { RoomProps } from './types';
import { EnhancedParticipantTile } from './EnhancedParticipantTile';

// This function will be called first when recording starts
const startRecording = () => {
  console.log('START_RECORDING');
};

// This function will be called when the room is disconnected
const endRecording = () => {
  console.log('END_RECORDING');
};

export default function Room({ serverUrl, token, layout }: RoomProps) {
  const [room] = useState(
    () =>
      new LivekitRoom({
        // Optimize for consistent quality
        adaptiveStream: true,
        dynacast: true,
        // Ensure participants with no video still have a placeholder
        videoCaptureDefaults: {
          resolution: Track.VideoPresets.h720.resolution,
        },
      })
  );

  const [connected, setConnected] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState<TrackPublication | null>(null);

  // Connect to the LiveKit room
  useEffect(() => {
    let connectFn = async () => {
      try {
        await room.connect(serverUrl, token);
        setConnected(true);
        startRecording();
      } catch (error) {
        console.error('Failed to connect to room:', error);
      }
    };

    connectFn();

    // Handle room connection state changes
    const handleConnectionStateChanged = (state: ConnectionState) => {
      if (state === ConnectionState.Disconnected) {
        endRecording();
      }
    };

    // Track screen shares
    const handleTrackPublished = (
      track: TrackPublication,
      participant: Participant
    ) => {
      if (track.source === Track.Source.ScreenShare) {
        setScreenShareTrack(track);
      }
    };

    const handleTrackUnpublished = (
      track: TrackPublication,
      participant: Participant
    ) => {
      if (track.source === Track.Source.ScreenShare) {
        setScreenShareTrack(null);
      }
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      
      room.disconnect();
    };
  }, [room, serverUrl, token]);

  // Get all camera and screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  if (!connected) {
    return <div className="loading">Connecting to room...</div>;
  }

  // Split tracks by type
  const screenShareTracks = tracks.filter(
    track => track.source === Track.Source.ScreenShare
  );
  const cameraTrack = tracks.filter(
    track => track.source === Track.Source.Camera
  );

  // Determine if we have screen shares
  const hasScreenShare = screenShareTracks.length > 0;

  return (
    <div className={`room-container ${hasScreenShare ? 'has-screen-share' : ''}`}>
      <RoomAudioRenderer />

      {hasScreenShare ? (
        <div className="room-with-screen-share">
          <div className="screen-share-container">
            {screenShareTracks.map(track => (
              <VideoRenderer 
                key={track.publication.trackSid} 
                track={track.publication} 
                isLocal={false}
              />
            ))}
          </div>
          <div className="participants-container">
            <GridLayout 
              tracks={cameraTrack}
              className="participants-grid"
            >
              <EnhancedParticipantTile />
            </GridLayout>
          </div>
        </div>
      ) : (
        <GridLayout tracks={cameraTrack}>
          <EnhancedParticipantTile />
        </GridLayout>
      )}
    </div>
  );
} 