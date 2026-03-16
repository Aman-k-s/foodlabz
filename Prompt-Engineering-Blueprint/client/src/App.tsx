import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import SearchPage from "@/pages/SearchPage";
import VerificationDashboard from "@/pages/VerificationDashboard";
import LabsDirectoryPage from "@/pages/LabsDirectoryPage";
import LabsMapPage from "@/pages/LabsMapPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SearchPage} />
      <Route path="/dashboard" component={SearchPage} />
      <Route path="/dashboard/" component={SearchPage} />
      <Route path="/labs" component={LabsDirectoryPage} />
      <Route path="/labs/map/all" component={LabsMapPage} />
      <Route path="/labs/map" component={LabsMapPage} />
      <Route path="/dashboard/:ulr" component={VerificationDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

