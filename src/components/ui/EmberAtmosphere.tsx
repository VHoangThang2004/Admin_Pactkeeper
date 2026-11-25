import React from 'react';

const EMBERS = [
  { left: '8%', size: 4, delay: '0s', duration: '11s' },
  { left: '19%', size: 3, delay: '2.2s', duration: '13s' },
  { left: '31%', size: 5, delay: '1.1s', duration: '10s' },
  { left: '44%', size: 3, delay: '3.6s', duration: '14s' },
  { left: '57%', size: 4, delay: '0.8s', duration: '12s' },
  { left: '68%', size: 3, delay: '4.1s', duration: '11.5s' },
  { left: '79%', size: 5, delay: '1.7s', duration: '13.5s' },
  { left: '91%', size: 4, delay: '2.9s', duration: '10.5s' },
] as const;

/**
 * Subtle GPU-composited golden ember motes drifting upward,
 * evoking the PactKeeper dark-fantasy citadel atmosphere.
 * Automatically disabled when prefers-reduced-motion is enabled.
 */
export const EmberAtmosphere: React.FC = () => {
  return (
    <div className="pk-ember-layer" aria-hidden="true">
      {EMBERS.map((ember, idx) => (
        <span
          key={idx}
          className="pk-ember-mote"
          style={{
            left: ember.left,
            width: `${ember.size}px`,
            height: `${ember.size}px`,
            animationDelay: ember.delay,
            animationDuration: ember.duration,
          }}
        />
      ))}
    </div>
  );
};
