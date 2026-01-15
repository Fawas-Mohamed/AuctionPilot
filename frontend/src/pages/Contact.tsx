import { Phone, Mail, MapPin, Clock, Send, MessageSquare } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Contact = () => {
  const contactInfo = [
    {
      icon: Phone,
      title: "Phone",
      details: ["0778523520", "0753834788"],
      description: "Mon-Fri 9AM-6PM EST"
    },
    {
      icon: Mail,
      title: "Email",
      details: ["AuctionPilot@gmail.com", "support@AuctionPilot.com"],
      description: "We respond within 24 hours"
    },
    {
      icon: MapPin,
      title: "Address",
      details: ["1,Kandy road Colombo"],
      description: "Gallery open by appointment"
    },
    {
      icon: Clock,
      title: "Business Hours",
      details: ["Mon-Fri: 9AM-6PM", "Sat: 10AM-4PM"],
      description: "Closed Sundays"
    }
  ];

  const departments = [
    { value: "general", label: "General Inquiry" },
    { value: "consignment", label: "Consignment" },
    { value: "authentication", label: "Authentication" },
    { value: "bidding", label: "Bidding Support" },
    { value: "technical", label: "Technical Support" },
    { value: "press", label: "Press & Media" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-auction-navy text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold">Contact Us</h1>
              <p className="text-xl md:text-2xl">
                Get in touch with our expert team. We're here to help with all your auction needs.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
              {contactInfo.map((info, index) => (
                <Card key={index} className="auction-shadow-elegant text-center">
                  <CardContent className="p-8">
                    <info.icon className="w-12 h-12 mx-auto mb-4 text-auction-premium" />
                    <h3 className="text-xl font-bold text-auction-navy mb-3">{info.title}</h3>
                    <div className="space-y-1 mb-3">
                      {info.details.map((detail, idx) => (
                        <p key={idx} className="font-medium">{detail}</p>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Contact Form and Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <Card className="auction-shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-2xl text-auction-navy flex items-center gap-2">
                    <MessageSquare className="w-6 h-6" />
                    Send us a Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input id="firstName" placeholder="John" required />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input id="lastName" placeholder="Doe" required />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input id="email" type="email" placeholder="john@example.com" required />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="0715844321" />
                  </div>
                  
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input id="subject" placeholder="How can we help you?" required />
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Please provide details about your inquiry..."
                      rows={6}
                      required 
                    />
                  </div>
                  
                  <Button variant="premium" className="w-full" size="lg">
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                  
                  <p className="text-sm text-muted-foreground text-center">
                    We'll respond to your inquiry within 24 hours
                  </p>
                </CardContent>
              </Card>

              {/* Map and Additional Info */}
              <div className="space-y-8">
                {/* Map Placeholder */}
                <Card className="auction-shadow-elegant">
                  <CardContent className="p-0">
                    <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MapPin className="w-12 h-12 mx-auto mb-2" />
                        <p>Interactive Map</p>
                        <p className="text-sm">1,Kandy road,Colombo</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Visit Us */}
                <Card className="auction-shadow-elegant">
                  <CardHeader>
                    <CardTitle className="text-xl text-auction-navy">Visit Our Gallery</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Experience our collection in person at our Manhattan gallery. 
                      Private viewings available by appointment.
                    </p>
                    <div className="space-y-2">
                      <p><strong>Gallery Hours:</strong></p>
                      <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                      <p>Saturday: 10:00 AM - 4:00 PM</p>
                      <p>Sunday: Closed</p>
                    </div>
                    <Button variant="outline" className="w-full">
                      Schedule a Visit
                    </Button>
                  </CardContent>
                </Card>

                {/* Emergency Contact */}
                <Card className="auction-shadow-elegant bg-auction-gold/10 border-auction-gold/20">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-auction-navy mb-2">Live Auction Support</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Need immediate assistance during a live auction?
                    </p>
                    <Button variant="premium" size="sm" className="w-full">
                      Emergency Hotline: (555) 911-HELP
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center space-y-4 mb-12">
                <h2 className="text-4xl font-bold text-auction-navy">Frequently Asked Questions</h2>
                <p className="text-lg text-muted-foreground">
                  Quick answers to common questions
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="auction-shadow-elegant">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-auction-navy mb-2">How do I register to bid?</h3>
                    <p className="text-muted-foreground">
                      Registration is free and takes just a few minutes. You'll need to provide 
                      identification and payment method verification.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="auction-shadow-elegant">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-auction-navy mb-2">What are your buyer's premiums?</h3>
                    <p className="text-muted-foreground">
                      Our buyer's premium is 25% on the first $300,000, and 20% on amounts above $300,000.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="auction-shadow-elegant">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-auction-navy mb-2">Can I view items before the auction?</h3>
                    <p className="text-muted-foreground">
                      Yes, we offer preview exhibitions before each auction. Check our calendar 
                      for specific dates and times.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="auction-shadow-elegant">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-auction-navy mb-2">Do you offer condition reports?</h3>
                    <p className="text-muted-foreground">
                      Detailed condition reports are available for all lots. Contact our specialists 
                      for specific items you're interested in.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Contact;