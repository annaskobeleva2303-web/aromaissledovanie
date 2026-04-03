const BrandIcon = ({
  className = "h-12 w-12",
  strokeWidth = 1.5,
  withBackground = false,
}: {
  className?: string;
  strokeWidth?: number;
  withBackground?: boolean;
}) => {
  const icon = (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={withBackground ? "h-[55%] w-[55%]" : className}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 6C24 6 12 20 12 28a12 12 0 0 0 24 0C36 20 24 6 24 6Z" />
    </svg>
  );

  if (withBackground) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 ${className}`}>
        {icon}
      </div>
    );
  }

  return icon;
};

export default BrandIcon;
