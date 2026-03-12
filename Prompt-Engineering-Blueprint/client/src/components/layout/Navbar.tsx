import { Building2, Search } from "lucide-react";
import { Link } from "wouter";
import { BrandLogo } from "@/components/common/BrandLogo";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <BrandLogo
            className="h-10 w-auto object-contain"
            fallbackClassName="w-10 h-10 bg-navy rounded-lg group-hover:bg-trust transition-colors flex items-center justify-center"
          />
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-navy transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" />
            Verify New ULR
          </Link>
          <Link href="/labs" className="text-sm font-medium text-muted-foreground hover:text-navy transition-colors flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            View All Labs
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-success animate-pulse"></span>
            <span className="text-xs font-medium text-muted-foreground">System Active</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
