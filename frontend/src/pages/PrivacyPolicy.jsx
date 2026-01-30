import React from 'react';
import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck } from 'lucide-react';

const PrivacyPolicy = () => {
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
              Privacy Policy
            </span>
          </h1>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <p className="text-sm text-[#2E2E2E]/60 mb-8">
              Last updated: January 2025
            </p>

            {/* Privacy Notice */}
            <div className="bg-gradient-to-r from-[#9E005C]/10 to-[#FF4D94]/10 rounded-xl p-6 mb-8 border border-[#9E005C]/20">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="w-6 h-6 text-[#9E005C]" />
                <h2 className="text-xl font-semibold text-[#2E2E2E]">Your Privacy Matters</h2>
              </div>
              <p className="text-[#2E2E2E]/80">
                At atsn ai, we are committed to protecting your privacy and ensuring the security 
                of your personal information. This policy explains how we collect, use, and protect 
                your data when you use our AI agent services.
              </p>
            </div>

            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Eye className="w-6 h-6 text-[#9E005C]" />
                <span>1. Information We Collect</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Name and email address for account creation</li>
                  <li>Payment information (processed securely through Razorpay)</li>
                  <li>Profile information you choose to provide</li>
                  <li>Communication preferences and support interactions</li>
                </ul>
                
                <h3 className="text-lg font-semibold">Usage Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>How you interact with our AI agents</li>
                  <li>Tasks performed and results generated</li>
                  <li>Device information and browser type</li>
                  <li>IP address and general location data</li>
                </ul>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Database className="w-6 h-6 text-[#FF4D94]" />
                <span>2. How We Use Your Information</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Service Delivery</h3>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• Provide AI agent functionality</li>
                      <li>• Process payments and subscriptions</li>
                      <li>• Deliver customer support</li>
                      <li>• Maintain account security</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">Service Improvement</h3>
                    <ul className="text-green-700 text-sm space-y-1">
                      <li>• Analyze usage patterns</li>
                      <li>• Improve AI agent performance</li>
                      <li>• Develop new features</li>
                      <li>• Optimize user experience</li>
                    </ul>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Lock className="w-6 h-6 text-[#3F2B96]" />
                <span>3. Data Security</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  We implement industry-standard security measures to protect your data:
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#9E005C] rounded-full"></div>
                      <span>End-to-end encryption for all data transmission</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FF4D94] rounded-full"></div>
                      <span>Secure cloud storage with regular backups</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#3F2B96] rounded-full"></div>
                      <span>Regular security audits and penetration testing</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Access controls and authentication protocols</span>
                    </li>
                  </ul>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">4. Data Sharing</h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  We do not sell, trade, or rent your personal information to third parties. 
                  We may share data only in these limited circumstances:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#9E005C] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">1</div>
                    <div>
                      <h3 className="font-semibold">Payment Processing</h3>
                      <p className="text-sm text-[#2E2E2E]/70">With Razorpay for secure payment processing</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#FF4D94] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">2</div>
                    <div>
                      <h3 className="font-semibold">Legal Requirements</h3>
                      <p className="text-sm text-[#2E2E2E]/70">When required by law or to protect our rights</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-[#3F2B96] text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">3</div>
                    <div>
                      <h3 className="font-semibold">Service Providers</h3>
                      <p className="text-sm text-[#2E2E2E]/70">With trusted partners who help us deliver our services</p>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <UserCheck className="w-6 h-6 text-[#9E005C]" />
                <span>5. Your Rights</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">You have the right to:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#9E005C] rounded-full"></div>
                      <span>Access your personal data</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FF4D94] rounded-full"></div>
                      <span>Correct inaccurate information</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#3F2B96] rounded-full"></div>
                      <span>Delete your account and data</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Export your data</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Opt-out of marketing communications</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Withdraw consent at any time</span>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">6. Cookies and Tracking</h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  We use cookies and similar technologies to enhance your experience:
                </p>
                <div className="bg-[#F6F6F6] rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    <li><strong>Essential Cookies:</strong> Required for basic website functionality</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how you use our service</li>
                    <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                    <li><strong>Marketing Cookies:</strong> Used for targeted advertising (with your consent)</li>
                  </ul>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">7. Data Retention</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  We retain your data only as long as necessary:
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span>Account data</span>
                    <span className="text-[#9E005C] font-semibold">Until account deletion</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span>Usage analytics</span>
                    <span className="text-[#FF4D94] font-semibold">2 years</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span>Support communications</span>
                    <span className="text-[#3F2B96] font-semibold">3 years</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span>Payment records</span>
                    <span className="text-green-600 font-semibold">7 years (legal requirement)</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">8. International Data Transfers</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p>
                  Your data may be transferred to and processed in countries other than your own. 
                  We ensure appropriate safeguards are in place to protect your data during such transfers, 
                  including standard contractual clauses and adequacy decisions.
                </p>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">9. Children's Privacy</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p>
                  Our services are not intended for children under 13 years of age. We do not 
                  knowingly collect personal information from children under 13. If we become 
                  aware that we have collected such information, we will take steps to delete it.
                </p>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">10. Changes to This Policy</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p>
                  We may update this privacy policy from time to time. We will notify you of any 
                  material changes by email or through our service. Your continued use of our 
                  services after such changes constitutes acceptance of the updated policy.
                </p>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">11. Contact Us</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  If you have any questions about this privacy policy or our data practices:
                </p>
                <div className="bg-[#F6F6F6] rounded-lg p-4">
                  <p className="mb-2">
                    <strong>Helpdesk Phone:</strong> <a href="tel:+919998198868" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">+91 99981 98868</a>
                  </p>
                  <p className="mb-2">
                    <strong>Helpdesk Email:</strong> <a href="mailto:services@atsnai.com" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">services@atsnai.com</a>
                  </p>
                  <p className="mb-2">
                    <strong>Privacy Email:</strong> privacy@atsnai.com
                  </p>
                  <p className="mb-2">
                    <strong>Data Protection Officer:</strong> dpo@atsnai.com
                  </p>
                  <p className="mb-2">
                    <strong>Response Time:</strong> Within 72 hours
                  </p>
                  <p>
                    <strong>Website:</strong> <a href="https://emily.atsnai.com" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">emily.atsnai.com</a>
                  </p>
                </div>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>For any issues in utilizing our services you may contact our helpdesk on 9998198868 or services@atsnai.com</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
