import { motion } from "framer-motion";
import { Database, LineChart, Brain, Target } from "lucide-react";

const steps = [
  {
    icon: Database,
    title: "Data Collection",
    description: "We evaluate historical team and player performance, head-to-head matchups, and situational trends.",
  },
  {
    icon: LineChart,
    title: "Market Evaluation",
    description: "Monitoring betting lines and identifying discrepancies that suggest value opportunities.",
  },
  {
    icon: Brain,
    title: "AI Probability Models",
    description: "Proprietary algorithms estimate the likelihood of outcomes based on injuries, form, and conditions.",
  },
  {
    icon: Target,
    title: "Practical Insights",
    description: "We filter results to focus on bets with the best value and realistic potential for success.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-primary blur-[128px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gradient-gold mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground font-body text-lg max-w-2xl mx-auto">
            A data-driven approach that delivers reliable picks without relying on guesswork
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="relative mx-auto mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                  <step.icon className="text-primary" size={32} />
                </div>
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground font-body text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
