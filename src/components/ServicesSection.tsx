import { motion } from "framer-motion";
import { TrendingUp, BookOpen, BarChart3, Shield } from "lucide-react";

const services = [
  {
    icon: TrendingUp,
    title: "AI-Powered Picks",
    description: "Our proprietary algorithms analyze trends, player stats, and game conditions to craft winning picks tailored just for you.",
  },
  {
    icon: BookOpen,
    title: "Betting Education",
    description: "Tutorials and resources to help you understand the ins and outs of sports betting, making you a more confident bettor.",
  },
  {
    icon: BarChart3,
    title: "Performance Reports",
    description: "Clear reports on our strategies and their performance, so you know exactly how we're helping you win.",
  },
  {
    icon: Shield,
    title: "Transparent Results",
    description: "Full commitment to transparency with verified track records and honest performance data you can trust.",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="py-24 bg-gradient-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gradient-gold mb-4">
            Our Services — Picks & More
          </h2>
          <p className="text-muted-foreground font-body max-w-2xl mx-auto text-lg">
            Data-driven insights that give you the edge in every bet
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-gold-subtle rounded-lg p-6 hover:border-primary/40 transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <service.icon className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground font-body text-sm leading-relaxed">
                {service.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
