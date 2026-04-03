const BrandIcon = ({ className = "h-12 w-12", strokeWidth = 1.2 }: { className?: string; strokeWidth?: number }) => (
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
    {/* Clean, minimal drop */}
    <path d="M24 6C24 6 12 20 12 28a12 12 0 0 0 24 0C36 20 24 6 24 6Z" />
  </svg>
);

export default BrandIcon;
