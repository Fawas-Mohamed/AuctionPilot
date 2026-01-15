import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, Phone, Mail, Clock } from "lucide-react";

const faqCategories = [
  {
    title: "Bidding & Auctions",
    questions: [
      {
        question: "How do I place a bid?",
        answer: "To place a bid, you must first register and verify your account. During live auctions, you can bid in real-time or set up proxy bids with your maximum amount."
      },
      {
        question: "What is a proxy bid?",
        answer: "A proxy bid allows you to set your maximum bid amount. Our system will automatically bid on your behalf up to that amount, incrementing as needed to maintain your leading position."
      },
      {
        question: "When does the auction end?",
        answer: "Each auction has a scheduled end time displayed on the lot page. Some auctions may extend if there are last-minute bids to ensure fair bidding opportunities."
      },
      {
        question: "What happens if I win?",
        answer: "Winning bidders will receive an email confirmation and invoice. Payment must be completed within 7 days, and items can be collected or shipped once payment is received."
      }
    ]
  },
  {
    title: "Payments & Fees",
    questions: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept major credit cards, bank transfers, and certified checks. For high-value items, we may require wire transfers or additional verification."
      },
      {
        question: "What is the buyer's premium?",
        answer: "Our buyer's premium is 25% of the hammer price up to $50,000, 20% from $50,001 to $1,000,000, and 12% above $1,000,000."
      },
      {
        question: "Are there additional taxes?",
        answer: "Local sales tax may apply depending on your location and the item type. This will be clearly indicated before you complete your bid."
      }
    ]
  },
  {
    title: "Shipping & Collection",
    questions: [
      {
        question: "How much does shipping cost?",
        answer: "Shipping costs vary by item size, weight, and destination. We provide quotes before shipment and use professional art handlers for fragile items."
      },
      {
        question: "Can I collect my item in person?",
        answer: "Yes, items can be collected from our premises by appointment. Please bring valid ID and proof of purchase."
      },
      {
        question: "Do you ship internationally?",
        answer: "We ship to most countries worldwide. International shipments may require additional documentation and are subject to local customs regulations."
      }
    ]
  },
  {
    title: "Account & Registration",
    questions: [
      {
        question: "How do I create an account?",
        answer: "Click 'Sign Up' and provide your email, create a password, and verify your email address. For bidding on high-value items, additional verification may be required."
      },
      {
        question: "Why do I need to verify my identity?",
        answer: "Identity verification helps prevent fraud and ensures compliance with anti-money laundering regulations. This is standard practice in the auction industry."
      },
      {
        question: "Can I update my account information?",
        answer: "Yes, you can update your profile information, billing address, and preferences in your account dashboard at any time."
      }
    ]
  }
];

const contactOptions = [
  {
    icon: Phone,
    title: "Phone Support",
    description: "Speak with our experts",
    contact: "0778523520",
    hours: "Mon-Fri 9AM-6PM EST"
  },
  {
    icon: Mail,
    title: "Email Support",
    description: "Get detailed assistance",
    contact: "AuctionPilot@gmail.com",
    hours: "24/7 - Response within 4 hours"
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    description: "Instant help available",
    contact: "Start Chat",
    hours: "Mon-Fri 9AM-6PM EST"
  }
];

export default function HelpCenter() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const filteredQuestions = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => 
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would submit to an API
    console.log("Contact form submitted:", contactForm);
    alert("Thank you for your message. We'll get back to you within 24 hours.");
    setContactForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Help Center</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find answers to your questions or get in touch with our support team
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 text-lg"
            />
          </div>
        </div>

        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {contactOptions.map((option, index) => (
            <Card key={index} className="text-center p-6 hover:shadow-md transition-shadow">
              <option.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">{option.title}</h3>
              <p className="text-muted-foreground mb-3">{option.description}</p>
              <Badge variant="outline" className="mb-2">{option.contact}</Badge>
              <p className="text-sm text-muted-foreground flex items-center justify-center">
                <Clock className="w-4 h-4 mr-1" />
                {option.hours}
              </p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* FAQ Section */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-semibold mb-8">Frequently Asked Questions</h2>
            
            {filteredQuestions.length > 0 ? (
              <div className="space-y-8">
                {filteredQuestions.map((category, categoryIndex) => (
                  <div key={categoryIndex}>
                    <h3 className="text-xl font-semibold mb-4 text-primary">{category.title}</h3>
                    <Accordion type="single" collapsible className="space-y-2">
                      {category.questions.map((faq, faqIndex) => (
                        <AccordionItem 
                          key={faqIndex} 
                          value={`${categoryIndex}-${faqIndex}`}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="text-left hover:no-underline">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No results found for "{searchTerm}"</p>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </div>
            )}
          </div>

          {/* Contact Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Still Need Help?</CardTitle>
                <p className="text-muted-foreground">
                  Send us a message and we'll get back to you within 24 hours.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <Input
                      placeholder="Your Name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder="Your Email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Subject"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Textarea
                      placeholder="Describe your question or issue..."
                      rows={5}
                      value={contactForm.message}
                      onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}