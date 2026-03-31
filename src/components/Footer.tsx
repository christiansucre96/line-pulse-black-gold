const Footer = () => {
  return (
    <footer className="bg-card border-t border-gold-subtle py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
                <span className="font-display text-sm font-bold text-primary-foreground">LP</span>
              </div>
              <span className="font-display text-xl font-bold text-gradient-gold tracking-wider">
                LINE PULSE
              </span>
            </div>
            <p className="text-muted-foreground font-body text-sm">
              Sports Betting, Picks and More
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-4 tracking-wider">Pages</h4>
            <ul className="space-y-2">
              {["Home", "About Us", "Packages", "News", "Contact"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-muted-foreground hover:text-primary font-body text-sm transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-4 tracking-wider">Quick Links</h4>
            <ul className="space-y-2">
              {["Privacy Policy", "Terms of Service", "Disclaimer", "Partners"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-muted-foreground hover:text-primary font-body text-sm transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gold-subtle pt-6">
          <p className="text-muted-foreground font-body text-xs text-center leading-relaxed">
            Line Pulse is committed to responsible gambling. Please bet responsibly. Always wager within your limits.
          </p>
          <p className="text-muted-foreground font-body text-xs text-center mt-2">
            Copyright © 2025. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
