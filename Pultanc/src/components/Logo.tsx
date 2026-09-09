import React from 'react';

export const Logo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 200 200"
    className={`inline-block shrink-0 ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background */}
    <rect width="200" height="200" fill="#FF0000" />
    
    {/* Left Vertical Bar (Stem) */}
    <polygon points="42,30 64,30 72,38 72,170 42,170" fill="#000000" />
    
    {/* Right Semi-Circle (Bowl) */}
    <path d="M 120 30 L 112 38 L 112 112 L 120 120 A 45 45 0 0 0 120 30 Z" fill="#000000" />
    
    {/* Play Button Shadow */}
    <polygon points="82,64 108,78 82,92" fill="#000000" opacity="0.3" />
    
    {/* Play Button */}
    <polygon points="79,61 105,75 79,89" fill="#000000" />
  </svg>
);

