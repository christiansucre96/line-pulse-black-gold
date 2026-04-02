import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Scanner", href: "/scanner", isRoute: true },
  { label: "Services", href: "#services" },
  { label: "Packages", href: "#packages" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-gold-subtle">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        
        {/* LOGO */}
        <a href="#home" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
            <span className="font-display text-sm font-bold text-primary-foreground">LP</span>
          </div>
          <span className="font-display text-xl font-bold text-gradient-gold tracking-wider">
            LINE PULSE
          </span>
        </a>

        {/* NAV LINKS */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="font-body text-sm text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="font-body text-sm text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* SIGN UP */}
          <button
            onClick={() => window.location.href = "/auth"}
            className="font-display text-sm px-5 py-2 border border-primary/30 text-primary rounded hover:bg-primary/10 transition-colors uppercase tracking-wider"
          >
            Sign Up
          </button>

          {/* LOGIN */}
          <button
            onClick={() => window.location.href = "/auth"}
            className="font-display text-sm px-5 py-2 bg-gradient-gold text-primary-foreground rounded hover:opacity-90 transition-opacity uppercase tracking-wider"
          >
            Login
          </button>
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-background border-b border-gold-subtle overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-4">
              
              {navLinks.map((link) =>
                link.isRoute ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className="font-body text-sm text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="font-body text-sm text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    {link.label}
                  </a>
                )
              )}

              {/* MOBILE LOGIN */}
              <button
                onClick={() => window.location.href = "/auth"}
                className="font-display text-sm px-5 py-2 bg-gradient-gold text-primary-foreground rounded text-center uppercase tracking-wider"
              >
                Login
              </button>

              {/* MOBILE SIGNUP */}
              <button
                onClick={() => window.location.href = "/auth"}
                className="font-display text-sm px-5 py-2 border border-primary/30 text-primary rounded text-center uppercase tracking-wider"
              >
                Sign Up
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
