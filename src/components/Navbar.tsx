import React, { useState } from 'react';
import { 
  Camera, 
  Download, 
  Settings, 
  Menu, 
  X,
  Grid3x3,
  BookOpen,
  LifeBuoy,
  Sparkles
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="w-full top-0 sticky z-50 bg-white/70 backdrop-blur-xl border-b border-white/40 premium-shadow">
      <div className="flex justify-between items-center px-6 py-3 max-w-7xl mx-auto h-[72px]">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
              <Camera className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          </div>
          
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg tracking-tight text-primary">
              DCam
            </span>
            <span className="text-[10px] font-medium text-on-surface-variant/70 tracking-widest uppercase hidden sm:block">
              Dhanis Camera
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { icon: Grid3x3, label: 'Gallery' },
            { icon: BookOpen, label: 'Docs' },
            { icon: LifeBuoy, label: 'Support' }
          ].map(({ icon: Icon, label }) => (
            <a
              key={label}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-full text-on-surface-variant/80 hover:text-primary transition-all duration-200 text-sm font-medium hover:bg-primary/5"
              href="#"
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span className="absolute inset-x-4 -bottom-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center" />
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-all duration-200 text-sm font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95"
            type="button"
          >
            <Sparkles className="w-4 h-4" />
            New Session
          </button>

          <button
            className="w-10 h-10 rounded-full hover:bg-surface-container/80 transition-all duration-200 flex items-center justify-center text-on-surface-variant/60 hover:text-primary"
            type="button"
            aria-label="Download"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            className="w-10 h-10 rounded-full hover:bg-surface-container/80 transition-all duration-200 flex items-center justify-center text-on-surface-variant/60 hover:text-primary"
            type="button"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-outline-variant/30 mx-1 hidden sm:block" />

          <button
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-all duration-200 flex items-center justify-center"
            type="button"
            aria-label="User profile"
          >
            <img
              alt="User profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCO5bzXUzRVueJ9h7nxQ1xO-oxkXGLGGVlBNbr7aPS22E4ybKrAs__iVwJpM88IZMgx7xZ4Dbq9us18q965YQatVnnjbpLCq41C4gCCnXd7PEpjhGl8OdFP9hA-YwKi3zWqKyPWcJPQTfjm0RTJp5PybTTgz1yvOkX7azpR6MTDuGAxE1LQJ6bEoVMUO_eUyqqP4ECitNT4L9uVlLtwys4vICr0R8Tr04HbT4q3AH-Xk924nh2dyikAYkT7aZfIg-E5_JREZyc7mbgz"
            />
          </button>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden w-10 h-10 rounded-full hover:bg-surface-container/80 transition-all duration-200 flex items-center justify-center text-on-surface-variant/60"
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-white/40 px-6 py-4">
          <div className="flex flex-col gap-1">
            {[
              { icon: Grid3x3, label: 'Gallery' },
              { icon: BookOpen, label: 'Docs' },
              { icon: LifeBuoy, label: 'Support' }
            ].map(({ icon: Icon, label }) => (
              <a
                key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all duration-200"
                href="#"
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </a>
            ))}
            
            <div className="h-px bg-outline-variant/20 my-2" />
            
            <button
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-primary bg-primary/5 hover:bg-primary/10 transition-all duration-200 font-medium"
              type="button"
            >
              <Sparkles className="w-5 h-5" />
              New Session
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;