import { useState } from "react";
import { ShieldCheck } from "lucide-react";

type BrandLogoProps = {
  className?: string;
  fallbackClassName?: string;
};

export function BrandLogo({ className = "h-10 w-auto", fallbackClassName = "" }: BrandLogoProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoFailed) {
    return (
      <div className={fallbackClassName || "w-10 h-10 bg-navy rounded-lg flex items-center justify-center"}>
        <ShieldCheck className="w-5 h-5 text-white" />
      </div>
    );
  }

  return (
    <img
      src="/api/media/reports/logo.png"
      alt="FoodLabz"
      className={className}
      onError={() => setLogoFailed(true)}
    />
  );
}
