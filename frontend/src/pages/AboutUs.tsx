import { Shield, Award, Users, Globe, Heart, Star } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import founderImage from "@/assets/founder1.jpg";

const AboutUs = () => {
  const values = [
    {
      icon: Shield,
      title: "Trust & Integrity",
      description: "We maintain the highest standards of authenticity and transparency in every auction."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "Our commitment to quality ensures exceptional experiences for collectors worldwide."
    },
    {
      icon: Users,
      title: "Community",
      description: "Building lasting relationships between collectors, dealers, and art enthusiasts."
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Connecting collectors across the world with rare and valuable items."
    }
  ];

  const stats = [
    { value: "25+", label: "Years of Experience" },
    { value: "500K+", label: "Items Sold" },
    { value: "100K+", label: "Registered Users" },
    { value: "$2B+", label: "Total Sales Volume" }
  ];

  const team = [
    {
      name: "Mohamed Fawas",
      role: "Founder & CEO",
      bio: "10 years of experience in fine art auctions",
      image: "/placeholder.svg"
    },
    {
      name: "Gams",
      role: "Chief Auctioneer",
      bio: "International auctioneer with expertise in Asian art and antiquities",
      image: "/placeholder.svg"
    },
    {
      name: "Faheek Ahmed",
      role: "Head of Authentication",
      bio: "Renowned expert in jewelry and luxury watches authentication",
      image: "/placeholder.svg"
    },
    {
      name: "Wilson",
      role: "Technology Director",
      bio: "Leading digital transformation in the auction industry",
      image: "/placeholder.svg"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30"> 
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-auction-navy text-white overflow-hidden">
          <div className="absolute inset-0 auction-gradient-hero opacity-90"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                About Auctions
              </h1>
              <p className="text-xl md:text-2xl leading-relaxed">
               10+ years of helping collectors find unique pieces—with trusted service and proven expertise.</p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-auction-premium mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-auction-navy">Our Story</h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Founded in Sri Lanka in 2025 by Mohamed Fawas, our auction house was built on a passion for connecting people with exceptional art, jewelry, and collectibles from around the world.
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Starting as a small local gallery, we have grown into a respected global auction platform that blends deep expertise with innovative technology to serve collectors everywhere.
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    We remain committed to providing personalized service and trusted knowledge, making collecting more accessible and enjoyable for everyone.
                  </p>
                </div>
                <div className="relative">
                  <img
                    src={founderImage}
                    alt="Auction house gallery"
                    className="rounded-lg shadow-2xl"/>
                  <div className="absolute -bottom-6 -right-6 bg-auction-gold p-6 rounded-lg shadow-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-auction-navy">Est.</div>
                      <div className="text-3xl font-bold text-auction-navy">2025</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-4xl font-bold text-auction-navy">Our Values</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                The principles that guide everything we do, from authentication to customer service
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <Card key={index} className="auction-shadow-elegant hover:scale-105 auction-transition">
                  <CardContent className="p-8 text-center">
                    <value.icon className="w-12 h-12 mx-auto mb-4 text-auction-premium" />
                    <h3 className="text-xl font-bold text-auction-navy mb-3">{value.title}</h3>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-4xl font-bold text-auction-navy">Meet Our Team</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Expert professionals with decades of combined experience in fine art and luxury goods
              </p>
            </div>            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card key={index} className="auction-shadow-elegant hover:scale-105 auction-transition">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 mx-auto bg-auction-gold/20 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-auction-navy">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-auction-navy">{member.name}</h3>
                        <p className="text-auction-premium font-medium">{member.role}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{member.bio}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-auction-navy text-white">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-4xl font-bold">Ready to Start Collecting?</h2>
              <p className="text-xl">
                Join thousands of collectors who trust Auctions for their most valuable acquisitions
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="gold" size="lg">
                  Browse Current Auctions
                </Button>
                <Link to ="/contact">
                <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-auction-navy">
                  Contact Our Experts
                </Button></Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutUs;