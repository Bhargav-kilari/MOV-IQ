import React, { useState } from 'react';
import { Dumbbell } from 'lucide-react';

export const ExerciseThumbnail = ({
  src,
  alt = 'Exercise',
  className = 'w-12 h-12',
  iconSize = 'w-5 h-5',
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`${className} rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden flex items-center justify-center shrink-0`}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Dumbbell className={`${iconSize} text-[#9CA3AF]`} />
      )}
    </div>
  );
};

export default ExerciseThumbnail;
