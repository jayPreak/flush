"use client";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 28,
};

export default function StarRating({
  rating,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
}: StarRatingProps) {
  const iconSize = sizeMap[size];

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform disabled:opacity-100 p-0 border-0 bg-transparent`}
            aria-label={`${i + 1} star`}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: iconSize,
                color: filled ? "#d7a400" : "#d1d5db",
                fontVariationSettings: filled
                  ? "'FILL' 1, 'wght' 400"
                  : "'FILL' 0, 'wght' 400",
              }}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
}
