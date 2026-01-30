import React from 'react';
import { ArrowLeft, Truck, Package, Clock, MapPin, Shield, CheckCircle, AlertCircle } from 'lucide-react';

const Shipping = () => {
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
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">
            <span className="bg-gradient-to-r from-[#2E2E2E] via-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
              Shipping Information
            </span>
          </h1>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <p className="text-sm text-[#2E2E2E]/60 mb-8">
              Last updated: January 2025
            </p>

            {/* Razorpay Shipping Notice */}
            <div className="bg-gradient-to-r from-[#9E005C]/10 to-[#FF4D94]/10 rounded-xl p-6 mb-8 border border-[#9E005C]/20">
              <div className="flex items-center space-x-3 mb-4">
                <Package className="w-6 h-6 text-[#9E005C]" />
                <h2 className="text-xl font-semibold text-[#2E2E2E]">Digital Service Delivery</h2>
              </div>
              <p className="text-[#2E2E2E]/80">
                atsn ai provides digital AI agent services that are delivered instantly upon subscription. 
                All payments are processed securely through Razorpay with immediate digital delivery.
              </p>
            </div>

            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Truck className="w-6 h-6 text-[#9E005C]" />
                <span>1. Service Delivery</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  Our AI agents are delivered digitally and are available immediately after successful 
                  subscription and payment processing through Razorpay.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">Instant Access</h3>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Services activated immediately after payment</li>
                        <li>• Access granted within minutes of subscription</li>
                        <li>• No waiting periods or shipping delays</li>
                        <li>• Available 24/7 from any device with internet</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Clock className="w-6 h-6 text-[#FF4D94]" />
                <span>2. Delivery Timeline</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <div className="bg-gradient-to-r from-[#F6F6F6] to-white rounded-lg p-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#9E005C] text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                      <span>Payment processed via Razorpay</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#FF4D94] text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                      <span>Account activated automatically</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#3F2B96] text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                      <span>Welcome email sent with access details</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                      <span>Full access to AI agents granted</span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#2E2E2E]/70">
                  <strong>Total delivery time:</strong> Typically within 5-10 minutes of successful Razorpay payment confirmation
                </p>
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> For Razorpay compliance, digital services are considered "delivered" immediately upon payment confirmation and email notification.
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <MapPin className="w-6 h-6 text-[#3F2B96]" />
                <span>3. Service Availability</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  Our AI agents are accessible from anywhere in the world with an internet connection:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Global Access</h3>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• Available worldwide</li>
                      <li>• No geographical restrictions</li>
                      <li>• Multi-language support</li>
                      <li>• Time zone independent</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-800 mb-2">Device Compatibility</h3>
                    <ul className="text-purple-700 text-sm space-y-1">
                      <li>• Web browsers (Chrome, Firefox, Safari)</li>
                      <li>• Mobile devices (iOS, Android)</li>
                      <li>• Desktop applications</li>
                      <li>• API integrations</li>
                    </ul>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Shield className="w-6 h-6 text-[#9E005C]" />
                <span>4. Data Security & Privacy</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  Your data and interactions with our AI agents are protected with enterprise-grade security:
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#9E005C] rounded-full"></div>
                      <span>End-to-end encryption for all communications</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FF4D94] rounded-full"></div>
                      <span>Secure cloud infrastructure with regular backups</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#3F2B96] rounded-full"></div>
                      <span>GDPR and privacy law compliance</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Regular security audits and monitoring</span>
                    </li>
                  </ul>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">5. Service Updates & Maintenance</h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  We continuously improve our AI agents with regular updates:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#9E005C] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">1</div>
                    <div>
                      <h3 className="font-semibold">Automatic Updates</h3>
                      <p className="text-sm text-[#2E2E2E]/70">AI agents receive updates automatically without service interruption</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#FF4D94] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">2</div>
                    <div>
                      <h3 className="font-semibold">Scheduled Maintenance</h3>
                      <p className="text-sm text-[#2E2E2E]/70">Planned maintenance windows with advance notice</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#3F2B96] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">3</div>
                      <div>
                        <h3 className="font-semibold">Feature Enhancements</h3>
                        <p className="text-sm text-[#2E2E2E]/70">New capabilities added regularly based on user feedback</p>
                      </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">6. Troubleshooting Delivery Issues</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  If you experience any issues accessing your AI agents after subscription:
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-800 mb-1">Common Solutions</h3>
                      <ul className="text-yellow-700 text-sm space-y-1">
                        <li>• Check your email for welcome message and login credentials</li>
                        <li>• Clear browser cache and cookies</li>
                        <li>• Try accessing from a different browser or device</li>
                        <li>• Verify your internet connection is stable</li>
                        <li>• Contact support if issues persist beyond 30 minutes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">7. Support & Contact</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  For any shipping or delivery-related questions:
                </p>
                <div className="bg-[#F6F6F6] rounded-lg p-4">
                  <p className="mb-2">
                    <strong>Helpdesk Phone:</strong> <a href="tel:+919998198868" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">+91 99981 98868</a>
                  </p>
                  <p className="mb-2">
                    <strong>Helpdesk Email:</strong> <a href="mailto:services@atsnai.com" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">services@atsnai.com</a>
                  </p>
                  <p className="mb-2">
                    <strong>Response Time:</strong> Within 24 hours
                  </p>
                  <p className="mb-2">
                    <strong>Live Chat:</strong> Available in your account dashboard
                  </p>
                  <p>
                    <strong>Emergency Support:</strong> Available 24/7 for critical issues
                  </p>
                </div>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>For any issues in utilizing our services you may contact our helpdesk on 9998198868 or services@atsnai.com</strong>
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">8. Razorpay Shipping Information</h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  For Razorpay payment processing compliance, the following shipping information applies:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-3">Digital Service Shipping Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Service Type:</p>
                      <p className="text-blue-600">Digital AI Agent Services</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Delivery Method:</p>
                      <p className="text-blue-600">Instant Digital Delivery</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Shipping Address:</p>
                      <p className="text-blue-600">Email Address (Digital)</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Delivery Time:</p>
                      <p className="text-blue-600">Immediate (0-10 minutes)</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Tracking:</p>
                      <p className="text-blue-600">Email Confirmation</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 mb-1">Return Policy:</p>
                      <p className="text-blue-600">30-day money-back guarantee</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">Razorpay Compliance</h3>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Digital services require no physical shipping</li>
                        <li>• Service delivery is immediate upon payment confirmation</li>
                        <li>• Customer receives access credentials via email</li>
                        <li>• All transactions are processed securely through Razorpay</li>
                        <li>• Refund policy complies with Razorpay guidelines</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">9. Terms and Conditions</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                This shipping policy is subject to our Terms and Conditions. 
                By using our services, you agree to these policies. For complete terms, 
                please visit our <a href="/terms" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">Terms and Conditions</a> page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shipping;
