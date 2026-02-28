import { ShieldCheck, Search, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="bg-navy p-2 rounded-lg group-hover:bg-trust transition-colors">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy tracking-tight leading-none">FoodLabz <span className="text-trust">Node 3</span></h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-none mt-1">Compliance Dashboard</p>
          </div>
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-navy transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" />
            Verify New ULR
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
