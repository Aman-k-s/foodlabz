type FoodLabzLogoProps = {
  className?: string;
};

export function FoodLabzLogo({ className }: FoodLabzLogoProps) {
  return (
    <svg
      viewBox="0 0 1290 233"
      role="img"
      aria-label="FoodLabz"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="#0f2245">
        <path d="M0 18h124v40H36v33h82v38H36v86H0V18z" />
        <path d="M128 89c0-48 31-77 82-77h58c51 0 82 29 82 77v55c0 48-31 77-82 77h-58c-51 0-82-29-82-77V89zm86-27c-17 0-28 10-28 27v55c0 17 11 27 28 27h50c17 0 28-10 28-27V89c0-17-11-27-28-27h-50z" />
        <path d="M360 89c0-48 31-77 82-77h58c51 0 82 29 82 77v55c0 48-31 77-82 77h-58c-51 0-82-29-82-77V89zm86-27c-17 0-28 10-28 27v55c0 17 11 27 28 27h50c17 0 28-10 28-27V89c0-17-11-27-28-27h-50z" />
        <path d="M591 18h136c71 0 112 39 112 99s-41 98-112 98H591V18zm131 148c34 0 53-18 53-49s-19-50-53-50h-67v99h67z" />
      </g>
      <g fill="#60d2e6">
        <path d="M860 18h37v151h122v46H860V18z" />
        <path d="M1029 215l99-197h67l-70 142h122V18h38v197h-65V92l-61 123h-160z" />
      </g>
    </svg>
  );
}
