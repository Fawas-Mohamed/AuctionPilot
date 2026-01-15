import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, Gavel } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";


const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password); // ✅ context handles token & user
      navigate("/"); // redirect after login
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center space-x-2 mb-6">
              <Gavel className="h-10 w-10 text-auction-gold" />
              <span className="text-3xl font-bold text-auction-navy">AuctionHouse</span>
            </Link>
            <h1 className="text-3xl font-bold text-auction-navy mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to your account to start bidding</p>
          </div>

          <Card className="auction-shadow-elegant">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember" className="text-sm">Remember me</Label>
                  </div>
                  <Link to="/forgot-password" className="text-sm text-auction-gold hover:text-auction-gold-light auction-transition">Forgot password?</Link>
                </div>
                {error && <div role="alert" className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
                <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="mt-6">
                <Separator className="my-4" />
                <p className="text-center text-sm text-muted-foreground">Or continue with</p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button variant="outline" className="w-full">Google</Button>
                  <Button variant="outline" className="w-full">Facebook</Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-center text-sm text-muted-foreground w-full">
                Don't have an account?{" "}
                <Link to="/register" className="text-auction-gold hover:text-auction-gold-light auction-transition font-semibold">Sign up here</Link>
              </p>
            </CardFooter>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              By signing in, you agree to our{" "}
              <Link to="/terms" className="text-auction-gold hover:text-auction-gold-light auction-transition">Terms of Service</Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-auction-gold hover:text-auction-gold-light auction-transition">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default Login;
