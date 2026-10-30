import React from 'react';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { MiniPlayer } from './MiniPlayer';
import { ExpandedPlayer } from './ExpandedPlayer';
import { RadioPipPlayer } from './RadioPipPlayer';

export const GlobalPlayer: React.FC = () => {
  // Mount global HTML5 Audio + HLS engine
  useAudioPlayer();

  return (
    <>
      <MiniPlayer />
      <ExpandedPlayer />
      <RadioPipPlayer />
    </>
  );
};

