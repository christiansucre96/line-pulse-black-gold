import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";

const features = [
  "Access to AI-powered Sports Betting Scanner",
  "Daily Picks and Parlays",
  "Sports Betting Tutorials",
  "Sports Betting Academy",
  "Special Challenges",
  "Community Group Chats",
  "Affiliate System",
  "Technical Support",
];

const PricingSection = () => {
  return (
    <section id="packages" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gradient-gold mb-4">
            Introductory Package
          </h2>
          <p className="text-muted-foreground font-body text-lg">
            Sport Analytical Scanner — Limited Time Offer
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto"
        >
          <div className="relative bg-card border-2 border-primary/40 rounded-xl overflow-hidden shadow-gold">
            <div className="bg-gradient-gold p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap className="text-primary-foreground" size={20} />
                <span className="font-display text-primary-foreground uppercase tracking-wider font-semibold">
                  Sport Analytical Scanner
                </span>
              </div>
              <p className="text-primary-foreground/70 font-body text-sm line-through">
                $899 USD Comparable Value
              </p>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <span className="text-5xl font-display font-bold text-primary">$100</span>
                <span className="text-muted-foreground font-body"> / month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="text-primary mt-0.5 shrink-0" size={18} />
                    <span className="text-foreground/80 font-body text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className="block text-center font-display text-lg px-8 py-4 bg-gradient-gold text-primary-foreground rounded-lg shadow-gold hover:opacity-90 transition-all uppercase tracking-widest font-semibold"
              >
                Sign Up 💰
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
