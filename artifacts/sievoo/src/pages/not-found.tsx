import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <AlertCircle className="h-16 w-16 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono uppercase tracking-widest text-foreground">404 - Not Found</h1>
            <p className="mt-2 text-sm text-muted-foreground font-mono">
              The requested resource could not be found.
            </p>
          </div>
          <div className="pt-4 border-t border-border">
            <Link 
              href="/" 
              className="text-sm font-mono uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
