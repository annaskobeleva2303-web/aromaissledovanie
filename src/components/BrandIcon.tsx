const BrandIcon = ({ className = "h-12 w-12", strokeWidth = 1 }: { className?: string; strokeWidth?: number }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Drop / seed shape */}
    <path d="M24 6C24 6 12 20 12 28a12 12 0 0 0 24 0C36 20 24 6 24 6Z" />
    {/* Inner leaf vein — organic essence */}
    <path d="M24 18c-4 4-6 9-5.5 14" />
    <path d="M24 18c3 5 4 10 3 14" />
    {/* Small leaf sprouting from drop */}
    <path d="M30 14c3-2 6-2.5 8-1.5" />
    <path d="M30 14c2 1 3.5 3.5 3 6" />
  </svg>
);

export default BrandIcon;
