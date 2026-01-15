import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Heart, Gavel, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    id: 1,
    icon: Search,
    title: "Browse & Discover",
    description: "Explore our curated collection of fine art, jewelry, antiques, and collectibles from around the world.",
    details: [
      "Browse categories or search specific items",
      "View detailed descriptions and high-resolution images",
      "Set up alerts for items you're interested in"
    ]
  },
  {
    id: 2,
    icon: Heart,
    title: "Register & Verify",
    description: "Create your account and complete our simple verification process to start bidding.",
    details: [
      "Quick registration with email verification",
      "Identity verification for high-value auctions",
      "Set your bidding preferences and limits"
    ]
  },
  {
    id: 3,
    icon: Gavel,
    title: "Place Your Bids",
    description: "Participate in live auctions or place proxy bids with our advanced bidding system.",
    details: [
      "Real-time bidding with instant notifications",
      "Automatic proxy bidding up to your maximum",
      "Professional auction house oversight"
    ]
  },
  {
    id: 4,
    icon: CreditCard,
    title: "Win & Pay",
    description: "Secure payment processing and worldwide shipping for your winning items.",
    details: [
      "Multiple secure payment options",
      "Professional packing and insured shipping",
      "Authentication certificates included"
    ]
  }
];

const tips = [
  {
    title: "Research Before Bidding",
    description: "Study the condition reports, provenance, and comparable sales data provided for each lot."
  },
  {
    title: "Set a Budget",
    description: "Determine your maximum bid including buyer's premium and any applicable taxes before the auction."
  },
  {
    title: "Inspect Items",
    description: "Attend preview exhibitions or request detailed condition reports for high-value items."
  },
  {
    title: "Understand Terms",
    description: "Review our terms and conditions, including payment deadlines and shipping policies."
  }
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">How It Works</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your guide to participating in our world-class auctions
          </p>
        </div>

        {/* Steps Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-semibold text-center mb-12">Getting Started</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <Card key={step.id} className="relative overflow-hidden">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <Badge variant="outline" className="absolute top-4 right-4">
                    {step.id}
                  </Badge>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-center">{step.description}</p>
                  <ul className="space-y-2 text-sm">
                    {step.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bidding Tips Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-semibold text-center mb-12">Bidding Tips</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tips.map((tip, index) => (
              <Card key={index} className="p-6">
                <h3 className="text-lg font-semibold mb-2">{tip.title}</h3>
                <p className="text-muted-foreground">{tip.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-12">
          <h2 className="text-3xl font-semibold mb-4">Ready to Start Bidding?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of collectors and art enthusiasts in our upcoming auctions
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Create Account</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/auctions">Browse Auctions</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}