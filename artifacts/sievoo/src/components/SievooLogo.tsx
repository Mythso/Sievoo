import { SVGProps } from 'react';

export function SievooLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      fill="none" 
      {...props}
    >
      <path
        d="M50 5 L85 20 L85 60 C85 80 65 95 50 95 C35 95 15 80 15 60 L15 20 Z"
        stroke="currentColor"
        strokeWidth="6"
        fill="none"
      />
      <path 
        d="M50 5 L85 20 L85 60 C85 80 65 95 50 95 C35 95 15 80 15 60 L15 20 Z"
        fill="url(#sievePattern)" 
      />
      <path
        d="M35 30 L65 30 M35 45 L65 45 M35 60 L65 60 M40 25 L40 65 M50 25 L50 65 M60 25 L60 65"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M30 70 C40 70 50 50 70 30"
        stroke="hsl(var(--accent))"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <polygon points="65,25 75,25 75,35" fill="hsl(var(--accent))" />

      <defs>
        <pattern id="sievePattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="10" y2="10" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.1" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>
    </svg>
  );
}
