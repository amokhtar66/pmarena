import {
  AudioTrack,
  ConnectionQualityIndicator,
  ParticipantContext,
  ParticipantName,
  TrackMutedIndicator,
  VideoTrack,
  useParticipant,
  useTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useMemo } from 'react';

export function EnhancedParticipantTile() {
  const { participant } = useParticipant();
  const { publication, isSubscribed } = useTrack(Track.Source.Camera);

  // Determine if this participant has a camera
  const hasCamera = !!publication;
  // Determine if the camera is enabled (not muted)
  const isCameraEnabled = hasCamera && !publication.isMuted;
  // Show video only if camera is on and subscribed
  const showVideo = isCameraEnabled && isSubscribed;

  // Generate display initials from participant name
  const displayInitials = useMemo(() => {
    const name = participant.name || participant.identity;
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, [participant.name, participant.identity]);

  return (
    <div className="lk-participant-tile">
      {/* Keep audio track to ensure we hear the participant */}
      <AudioTrack
        source={Track.Source.Microphone}
        participant={participant}
      />

      {/* Render video or placeholder */}
      {showVideo ? (
        <VideoTrack
          participant={participant}
          source={Track.Source.Camera}
        />
      ) : (
        <div className="lk-participant-placeholder">
          <div className="participant-initials">{displayInitials}</div>
          <div className="participant-name">{participant.name || participant.identity}</div>
        </div>
      )}

      {/* Show metadata: name, mute state, connection quality */}
      <div className="lk-participant-metadata">
        <ParticipantName />
        <TrackMutedIndicator source={Track.Source.Microphone} />
        <TrackMutedIndicator source={Track.Source.Camera} />
        <ConnectionQualityIndicator />
      </div>
    </div>
  );
} 