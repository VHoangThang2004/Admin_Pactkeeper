import React from 'react';

interface SkeletonBlockProps {
  className?: string;
  count?: number;
}

/**
 * Gold-tinted AAA shimmer skeleton block for loading states.
 */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  className = 'h-10 w-full rounded-lg',
  count = 1,
}) => {
  if (count <= 1) {
    return <div className={`pk-skeleton ${className}`} aria-hidden="true" />;
  }

  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`pk-skeleton ${className}`}
          style={{ animationDelay: `${idx * 75}ms` }}
        />
      ))}
    </div>
  );
};
