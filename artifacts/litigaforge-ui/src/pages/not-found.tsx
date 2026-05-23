import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md mx-4 shadow-xl border-border">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
             <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">404 - Not Found</h1>
          <p className="text-base text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Button asChild size="lg" className="w-full">
            <Link href="/">
              <ArrowLeft className="w-5 h-5 mr-2" /> Return to The Forge
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}