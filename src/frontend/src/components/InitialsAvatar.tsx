import { getAvatarColor, getInitials } from "../utils/formatters";

interface InitialsAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "w-8 h-8 text-xs", font: "text-xs" },
  md: { container: "w-10 h-10 text-sm", font: "text-sm" },
  lg: { container: "w-12 h-12 text-base", font: "text-base" },
};

export function InitialsAvatar({
  name,
  size = "md",
  className = "",
}: InitialsAvatarProps) {
  const initials = getInitials(name);
  const color = getAvatarColor(name);
  const { container } = sizeMap[size];

  return (
    <div
      className={`${container} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
