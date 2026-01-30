import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { 
  ArrowRight, 
  Check, 
  Users, 
  Zap, 
  Brain, 
  Play,
  ChevronDown,
  Menu,
  X,
  Facebook,
  Youtube,
  Linkedin
} from 'lucide-react';

const Page = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'agents', 'pricing'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "atsn ai",
    "description": "atsn ai | Autonomous AI Agents, Custom AI Agents and Chatbots ",
    "url": "https://atsnai.com",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "4999",
      "priceCurrency": "INR",
      "priceSpecification": {
        "@type": "PriceSpecification",
        "price": "4999",
        "priceCurrency": "INR",
        "billingDuration": "P1M"
      }
    },
    "creator": {
      "@type": "Organization",
      "name": "atsn ai",
      "url": "https://atsnai.com"
    },
    "featureList": [
      "Autonomous AI Agents",
      "Digital Marketing Automation",
      "Content Creation",
      "Social Media Management",
      "Campaign Optimization",
      "Analytics & Reporting"
    ]
  };

  return (
    <>
      <SEO
        title="atsn ai | Autonomous AI Agents, Custom AI Agents and Chatbots"
        description="atsn ai creates autonomous AI agents, chatbots, and consultancy solutions. Meet Emily, your AI marketing teammate for smarter business automation."
        keywords="AI agents, autonomous AI, digital marketing AI, Emily AI agent, AI content creation, social media automation, AI marketing, business automation, AI chatbot, AI consultancy, artificial intelligence"
        structuredData={structuredData}
      />
      
      <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
              <div className="text-xl sm:text-2xl md:text-3xl font-normal bg-gradient-to-r from-pink-400 to-white bg-clip-text text-transparent">
                atsn ai
              </div>
              <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                <button
                  onClick={() => scrollToSection('features')}
                  className={`text-sm sm:text-base transition-colors font-normal ${activeSection === 'features' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                >
                  Features
                </button>
                <button
                  onClick={() => scrollToSection('agents')}
                  className={`text-sm sm:text-base transition-colors font-normal ${activeSection === 'agents' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                >
                  Agents
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className={`text-sm sm:text-base transition-colors font-normal ${activeSection === 'pricing' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                >
                  Pricing
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <a
                href="/login"
                className="hidden md:block text-sm sm:text-base text-gray-300 hover:text-white transition-colors font-normal"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="bg-pink-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-normal hover:bg-pink-700 transition-all duration-300 transform hover:scale-105"
              >
                Get Started
              </a>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-white"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-gray-900/95 backdrop-blur-xl">
          <div className="flex flex-col items-center justify-center h-full space-y-6 sm:space-y-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('agents')}
              className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
            >
              Agents
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
            >
              Pricing
            </button>
            <a
              href="/login"
              className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="bg-pink-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-normal hover:bg-pink-700 transition-all duration-300"
            >
              Get Started
            </a>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="hero" className="relative min-h-[60vh] sm:min-h-[70vh] md:min-h-screen flex items-center justify-center py-8 sm:py-12 md:py-0">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-purple-900/30 to-blue-900/30"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.1),transparent_50%)]"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center pt-12 sm:pt-0">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-3 sm:mb-4 md:mb-6 lg:mb-8 leading-tight px-2">
            <div className="block">
              <span className="bg-gradient-to-r from-white to-pink-400 bg-clip-text text-transparent whitespace-nowrap">
                Autonomous AI Agents
              </span>
            </div>
            <div className="block">
              <span className="bg-gradient-to-r from-pink-400 to-white bg-clip-text text-transparent whitespace-nowrap">
                Empowering Your Business
              </span>
            </div>
          </h1>
        
          <p className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-4 sm:mb-6 md:mb-8 lg:mb-10 xl:mb-12 max-w-3xl mx-auto leading-relaxed px-4 font-normal">
            AI teammates that work autonomously to automate tasks, 
            boost productivity, and transform how you work.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-6 px-4">
            <a
              href="/signup"
              className="group bg-pink-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-normal hover:bg-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <button className="flex items-center space-x-2 text-sm sm:text-base text-gray-300 hover:text-white transition-colors font-normal">
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Watch Demo</span>
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => scrollToSection('features')}
            className="text-gray-400 hover:text-white transition-colors animate-bounce"
          >
            <ChevronDown size={24} />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 lg:py-20 bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mb-3 sm:mb-4 md:mb-6 text-white">
              Why Choose atsn ai Agents?
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto px-4 font-normal">
              Our AI agents are designed to work independently, learn from your preferences,
              and continuously improve their performance.
            </p>
          </div>

          {/* Agent Icons Showcase */}
          <div className="w-full mx-auto px-4 sm:px-6 mb-10 sm:mb-12 lg:mb-16">
            <div className="flex justify-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 lg:gap-12 max-w-4xl">
                {/* Emily Icon */}
                <div className="flex flex-col items-center group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-110 mb-3">
                    <img src="/emily_icon.png" alt="Emily" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover" />
                  </div>
                  <h3 className="text-white font-normal text-sm sm:text-base md:text-lg text-center">Emily</h3>
                  <p className="text-gray-400 font-normal text-xs sm:text-sm text-center">Marketing Agent</p>
                </div>

                {/* Leo Icon */}
                <div className="flex flex-col items-center group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-110 mb-3">
                    <img src="/leo_logo.png" alt="Leo" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover" />
                  </div>
                  <h3 className="text-white font-normal text-sm sm:text-base md:text-lg text-center">Leo</h3>
                  <p className="text-gray-400 font-normal text-xs sm:text-sm text-center">Content Agent</p>
                </div>

                {/* Chase Icon */}
                <div className="flex flex-col items-center group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-green-500/25 transition-all duration-300 transform hover:scale-110 mb-3">
                    <img src="/chase_logo.png" alt="Chase" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover" />
                  </div>
                  <h3 className="text-white font-normal text-sm sm:text-base md:text-lg text-center">Chase</h3>
                  <p className="text-gray-400 font-normal text-xs sm:text-sm text-center">Lead Agent</p>
                </div>

                {/* Orion Icon */}
                <div className="flex flex-col items-center group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-110 mb-3">
                    <img src="/orion.png" alt="Orion" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover" />
                  </div>
                  <h3 className="text-white font-normal text-sm sm:text-base md:text-lg text-center">Orion</h3>
                  <p className="text-gray-400 font-normal text-xs sm:text-sm text-center">Analytics Agent</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Fully Autonomous</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                Our agents work independently, making decisions and taking actions 
                without constant supervision.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Lightning Fast</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                Execute complex tasks in seconds, not hours. 
                Our agents are optimized for speed and efficiency.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Always Learning</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                Continuously improve and adapt to your workflow, 
                becoming more effective over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="py-12 sm:py-16 lg:py-20 bg-gray-900">
        <div className="w-full mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mb-3 sm:mb-4 md:mb-6 text-white">
              Meet Your AI Team
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto px-4 font-normal">
              Your dedicated AI team working together to automate your business processes.
            </p>
          </div>

          {/* Agent Description Cards */}
          <div className="w-[95%] md:w-5/6 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {/* Emily - Digital Marketing Agent */}
            <div className="relative group">
              <div className="absolute inset-0 bg-pink-500/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-600 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/emily_icon.png" alt="Emily" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-normal text-white">Emily</h3>
                    <p className="text-sm sm:text-base text-gray-300 font-normal">Digital Marketing Agent</p>
                    <div className="inline-flex items-center space-x-1 bg-green-500/30 text-green-400 px-2 py-1 rounded-full text-xs mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Now Live</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 leading-relaxed font-normal">
                  Your dedicated digital marketing specialist who handles content creation, social media management,
                  campaign optimization, and analytics - all autonomously to boost your online presence.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Content Creation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Social Media</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Campaign Optimization</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Analytics & Reporting</span>
                  </div>
                </div>

                <a
                  href="/login"
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-3 rounded-xl font-normal hover:from-pink-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Access Emily
                </a>
              </div>
            </div>
            
            {/* Leo - Content Creation Agent */}
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-600 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/leo_logo.png" alt="Leo" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-normal text-white">Leo</h3>
                    <p className="text-sm sm:text-base text-gray-300 font-normal">Content Creation Agent</p>
                    <div className="inline-flex items-center space-x-1 bg-green-500/30 text-green-400 px-2 py-1 rounded-full text-xs mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Now Live</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 leading-relaxed font-normal">
                  Your creative content specialist who crafts compelling copy, designs engaging visuals,
                  and produces high-quality content across all platforms to captivate your audience.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Content Writing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Visual Design</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Brand Consistency</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Multi-Platform Content</span>
                  </div>
                </div>

                <a
                  href="/login"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-normal hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Access Leo
                </a>
              </div>
            </div>
            
            {/* Chase - Lead Management Agent */}
            <div className="relative group">
              <div className="absolute inset-0 bg-green-500/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-600 hover:border-green-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/chase_logo.png" alt="Chase" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-normal text-white">Chase</h3>
                    <p className="text-sm sm:text-base text-gray-300 font-normal">Lead Management Agent</p>
                    <div className="inline-flex items-center space-x-1 bg-green-500/30 text-green-400 px-2 py-1 rounded-full text-xs mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Now Live</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 leading-relaxed font-normal">
                  Your strategic lead generation and relationship-building expert who identifies prospects,
                  manages customer relationships, and ensures no opportunity slips through the cracks.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Lead Generation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">CRM Management</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Follow-up Automation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Relationship Building</span>
                  </div>
                </div>

                <a
                  href="/login"
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-normal hover:from-green-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Access Chase
                </a>
              </div>
            </div>

            {/* Orion - Analytics Agent */}
            <div className="relative group">
              <div className="absolute inset-0 bg-purple-500/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-600 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/orion.png" alt="Orion" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-normal text-white">Orion</h3>
                    <p className="text-sm sm:text-base text-gray-300 font-normal">Analytics Agent</p>
                    <div className="inline-flex items-center space-x-1 bg-green-500/30 text-green-400 px-2 py-1 rounded-full text-xs mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Now Live</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 leading-relaxed font-normal">
                  Your data-driven insights specialist who analyzes performance metrics, uncovers trends,
                  and provides actionable intelligence to optimize your business strategies.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Performance Analytics</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Trend Analysis</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">ROI Tracking</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-normal">Strategic Insights</span>
                  </div>
                </div>

                <a
                  href="/login"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-normal hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Access Orion
                </a>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mb-3 sm:mb-4 md:mb-6 text-white">
              Simple Pricing
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto px-4 font-normal">
              Choose the plan that fits your needs. All plans include access to our AI agents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Freemium Plan */}
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-600 hover:border-green-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 text-white">Freemium</h3>
                <div className="text-xl sm:text-2xl md:text-3xl font-normal mb-2">
                  <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">Free</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 font-normal">Get started with basic features</p>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Access to All AI Agents</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Basic Social Media Generation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Limited Tasks</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Basic Support</span>
                </div>
              </div>

              <a
                href="/signup"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-normal hover:from-green-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center"
              >
                Get Started
              </a>
            </div>

            {/* Starter Plan */}
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-600 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 text-white">Starter</h3>
                <div className="text-xl sm:text-2xl md:text-3xl font-normal mb-2">
                  <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">₹3499</span>
                  <span className="text-gray-400 text-xs sm:text-sm md:text-base font-normal">/month</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 font-normal">Perfect for small teams</p>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">All Agent Access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Social Media Generation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Basic Blog Generation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Lead Management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Basic Analytics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Email Support</span>
                </div>
              </div>

              <a
                href="/signup"
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-normal hover:from-pink-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center"
              >
                Get Started
              </a>
            </div>

            {/* Advanced Plan */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#FF4D94]/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-pink-500/50 shadow-lg hover:shadow-xl">
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-normal">
                    Most Popular
                  </div>
                </div>

                <div className="text-center mb-6 sm:mb-8">
                  <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 text-white">Advanced</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-normal mb-2">
                    <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">₹7999</span>
                    <span className="text-gray-400 text-sm sm:text-base md:text-lg font-normal">/month</span>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base text-gray-300 font-normal">For growing businesses and teams</p>
                </div>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">All Agent Access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">Everything in Starter</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">Maximum Tasks & Generations</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">AI Content Optimization</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">Advanced SEO Tools</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-300 font-normal">Performance Analytics Dashboard</span>
                  </div>
                </div>
                
                <a
                  href="/signup"
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-normal hover:from-pink-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Get Started
                </a>
              </div>
            </div>
            
            {/* Enterprise Plan */}
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-600 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="text-center mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 text-white">Pro</h3>
                <div className="text-xl sm:text-2xl md:text-3xl font-normal mb-2">
                  <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">₹9999</span>
                  <span className="text-gray-400 text-xs sm:text-sm md:text-base font-normal">/month</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 font-normal">For enterprises & large teams</p>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Everything in Advanced</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Custom AI Agent Development</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">24/7 Priority Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Dedicated Success Manager</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Enterprise API Access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Advanced Security & Compliance</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Early Access to New Agents</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-300 font-normal">Custom Training & Onboarding</span>
                </div>
              </div>

              <a
                href="/signup"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-normal hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-700 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-normal text-white mb-4">
                atsn ai
              </div>
              <p className="text-gray-300 mb-4 font-normal">
                The future of autonomous AI agents that work for you.
              </p>
              <div className="flex space-x-3 sm:space-x-4">
                <a href="https://www.facebook.com/profile.php?id=61571044832864" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#1877F2] hover:border-[#1877F2] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(24,119,242,0.6)]">
                  <Facebook className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </a>
                <a 
                  href="https://www.instagram.com/atsn.ai/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#C2185B] hover:border-[#C2185B] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(194,24,91,0.6)]"
                >
                  <i className="fa-brands fa-instagram text-white text-lg sm:text-2xl"></i>
                </a>
                <a href="https://x.com/atsn_ai" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-black hover:border-black transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(0,0,0,0.6)]">
                  <i className="fa-brands fa-x-twitter text-white text-base sm:text-xl"></i>
                </a>
                <a href="https://www.youtube.com/@ATSNAI" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#FF0000] hover:border-[#FF0000] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(255,0,0,0.6)]">
                  <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </a>
                <a href="https://www.linkedin.com/company/atsn-ai/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#0077B5] hover:border-[#0077B5] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(0,119,181,0.6)]">
                  <Linkedin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-normal mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Features</a></li>
                <li><a href="#pricing" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Pricing</a></li>
                <li><a href="/login" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Emily App</a></li>
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-normal mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">About</a></li>
                <li><Link to="/blog" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Blog</Link></li>
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Careers</a></li>
                <li><Link to="/contact" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-normal mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Help Center</a></li>
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Community</a></li>
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Status</a></li>
                <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm font-normal">
              © 2025 atsn ai. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Privacy</Link>
              <Link to="/terms" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Terms</Link>
              <Link to="/cancellation-refunds" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Cancellation & Refunds</Link>
              <Link to="/shipping" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Shipping</Link>
              <a href="#" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Page;