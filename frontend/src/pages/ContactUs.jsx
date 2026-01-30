import React, { useState } from 'react';
import { ArrowLeft, Phone, Mail, MapPin, Clock, Send, CheckCircle } from 'lucide-react';

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com';
      const baseUrl = API_BASE_URL.replace(/\/+$/, '');
      
      const response = await fetch(`${baseUrl}/api/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setIsSubmitted(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({ name: '', email: '', subject: '', message: '' });
        }, 3000);
      } else {
        alert('Failed to send message. Please try again later.');
      }
    } catch (error) {
      console.error('Error submitting contact form:', error);
      alert('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#2E2E2E]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#2E2E2E]/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
              atsn ai
            </div>
            <a
              href="/"
              className="flex items-center space-x-2 text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">
            <span className="bg-gradient-to-r from-[#2E2E2E] via-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
              Contact Us
            </span>
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div className="space-y-8">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <h2 className="text-2xl font-semibold mb-6 text-[#2E2E2E]">
                  Get in Touch
                </h2>
                <p className="text-[#2E2E2E]/80 mb-8">
                  We'd love to hear from you. Send us a message and we'll respond as soon as possible.
                </p>

                {/* Contact Details */}
                <div className="space-y-6">
                  {/* Phone */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2E2E2E] mb-1">Phone</h3>
                      <p className="text-[#2E2E2E]/80 mb-2">Call us for immediate assistance</p>
                      <a 
                        href="tel:+919998198868" 
                        className="text-[#9E005C] hover:text-[#FF4D94] transition-colors font-medium"
                      >
                        +91 99981 98868
                      </a>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#FF4D94] to-[#3F2B96] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2E2E2E] mb-1">Email</h3>
                      <p className="text-[#2E2E2E]/80 mb-2">Send us an email anytime</p>
                      <a 
                        href="mailto:services@atsnai.com" 
                        className="text-[#9E005C] hover:text-[#FF4D94] transition-colors font-medium"
                      >
                        services@atsnai.com
                      </a>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#3F2B96] to-[#9E005C] rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2E2E2E] mb-1">Office Address</h3>
                      <p className="text-[#2E2E2E]/80 mb-2">Visit our office in Ahmedabad</p>
                      <address className="text-[#2E2E2E]/80 not-italic">
                        3rd Floor, Office No. 314<br />
                        Gala Magnus, Opp Safal Parisar 1<br />
                        South Bopal, Ahmedabad<br />
                        Gujarat, 380058
                      </address>
                    </div>
                  </div>

                  {/* Business Hours */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2E2E2E] mb-1">Business Hours</h3>
                      <p className="text-[#2E2E2E]/80 mb-2">We're here to help</p>
                      <div className="text-[#2E2E2E]/80 space-y-1">
                        <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                        <p>Saturday: 10:00 AM - 4:00 PM</p>
                        <p>Sunday: Closed</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Response */}
              <div className="bg-gradient-to-r from-[#9E005C]/10 to-[#FF4D94]/10 rounded-xl p-6 border border-[#9E005C]/20">
                <h3 className="text-lg font-semibold text-[#2E2E2E] mb-3">Quick Response Guarantee</h3>
                <div className="space-y-2 text-sm text-[#2E2E2E]/80">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Email responses within 24 hours</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Phone support during business hours</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Live chat available in your dashboard</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-[#2E2E2E]">
                Send us a Message
              </h2>

              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#2E2E2E] mb-2">Message Sent!</h3>
                  <p className="text-[#2E2E2E]/80">
                    Thank you for contacting us. We'll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-[#2E2E2E]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E005C] focus:border-transparent transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-[#2E2E2E]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E005C] focus:border-transparent transition-all"
                      placeholder="Enter your email address"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-[#2E2E2E]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E005C] focus:border-transparent transition-all"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-[#2E2E2E]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E005C] focus:border-transparent transition-all resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white py-3 rounded-xl font-medium hover:from-[#FF4D94] hover:to-[#9E005C] transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Send className={`w-5 h-5 ${isSubmitting ? 'animate-pulse' : ''}`} />
                    <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div className="mt-12 bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-6 text-[#2E2E2E] text-center">
              Find Us
            </h2>
            <div className="bg-[#F6F6F6] rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] rounded-xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-[#2E2E2E] mb-2">Our Office Location</h3>
              <p className="text-[#2E2E2E]/80 mb-4">
                3rd Floor, Office No. 314, Gala Magnus<br />
                Opp Safal Parisar 1, South Bopal<br />
                Ahmedabad, Gujarat, 380058
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://maps.google.com/?q=Gala+Magnus,+South+Bopal,+Ahmedabad,+Gujarat+380058"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white px-6 py-3 rounded-xl font-medium hover:from-[#FF4D94] hover:to-[#9E005C] transition-all duration-300 transform hover:scale-105"
                >
                  Open in Google Maps
                </a>
                <a
                  href="tel:+919998198868"
                  className="bg-gradient-to-r from-[#3F2B96] to-[#9E005C] text-white px-6 py-3 rounded-xl font-medium hover:from-[#9E005C] hover:to-[#3F2B96] transition-all duration-300 transform hover:scale-105"
                >
                  Call Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
