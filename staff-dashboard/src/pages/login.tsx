import { useState } from "react";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChefHat } from "lucide-react";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const { login, isLoggingIn, loginError } = useStaffAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    try {
      await login(passcode);
    } catch (err) {
      // Error is handled by the hook and displayed below
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4" data-testid="page-login">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Staff Console</CardTitle>
          <CardDescription>Enter your restaurant passcode to view active orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="text-center text-xl tracking-widest font-mono"
                disabled={isLoggingIn}
                data-testid="input-passcode"
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive text-center" data-testid="text-login-error">
                {loginError.message || "Invalid passcode"}
              </p>
            )}
            <Button 
              type="submit" 
              className="w-full font-bold" 
              disabled={isLoggingIn || !passcode.trim()}
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Access Console"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
