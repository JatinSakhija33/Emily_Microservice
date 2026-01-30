import React from 'react';
import { ArrowLeft, CreditCard, Shield, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const CancellationAndRefunds = () => {
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
              Cancellation & Refunds
            </span>
          </h1>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <p className="text-sm text-[#2E2E2E]/60 mb-8">
              Last updated: January 2025
            </p>

            {/* Razorpay Integration Notice */}
            <div className="bg-gradient-to-r from-[#9E005C]/10 to-[#FF4D94]/10 rounded-xl p-6 mb-8 border border-[#9E005C]/20">
              <div className="flex items-center space-x-3 mb-4">
                <CreditCard className="w-6 h-6 text-[#9E005C]" />
                <h2 className="text-xl font-semibold text-[#2E2E2E]">Razorpay Payment Integration</h2>
              </div>
              <p className="text-[#2E2E2E]/80">
                All payments for atsn ai services are processed securely through Razorpay, 
                India's leading payment gateway. This ensures your financial information is 
                protected with bank-level security.
              </p>
            </div>

            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Shield className="w-6 h-6 text-[#9E005C]" />
                <span>1. Refund Policy</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  We offer a 30-day money-back guarantee for all new subscriptions. If you're not 
                  completely satisfied with our AI agents within the first 30 days, you can request 
                  a full refund.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">Refund Eligibility</h3>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Request made within 30 days of initial subscription</li>
                        <li>• No refunds for usage-based charges already incurred</li>
                        <li>• Refunds processed within 5-7 business days</li>
                        <li>• Refund amount credited to original payment method</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E] flex items-center space-x-2">
                <Clock className="w-6 h-6 text-[#FF4D94]" />
                <span>2. Cancellation Policy</span>
              </h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  You can cancel your subscription at any time. Cancellations take effect at the 
                  end of your current billing period, and you'll retain access to all features 
                  until then.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-800 mb-1">Important Notes</h3>
                      <ul className="text-blue-700 text-sm space-y-1">
                        <li>• No partial refunds for unused time in current billing period</li>
                        <li>• Cancellation prevents auto-renewal for next billing cycle</li>
                        <li>• You can reactivate your subscription anytime</li>
                        <li>• Data and settings are preserved for 90 days after cancellation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">3. How to Request Refunds</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  To request a refund or cancel your subscription:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log into your account at <a href="https://emily.atsnai.com/login" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">emily.atsnai.com</a></li>
                  <li>Navigate to Account Settings → Billing</li>
                  <li>Click "Request Refund" or "Cancel Subscription"</li>
                  <li>Follow the prompts to complete your request</li>
                  <li>You'll receive email confirmation within 24 hours</li>
                </ol>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">4. Razorpay Payment Processing</h2>
              <div className="mb-6 text-[#2E2E2E]/80 space-y-4">
                <p>
                  All payments are processed through Razorpay, which supports:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Payment Methods</h3>
                    <ul className="text-sm space-y-1">
                      <li>• Credit/Debit Cards</li>
                      <li>• Net Banking</li>
                      <li>• UPI (PhonePe, Google Pay, etc.)</li>
                      <li>• Wallets (Paytm, Mobikwik)</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Security Features</h3>
                    <ul className="text-sm space-y-1">
                      <li>• PCI DSS Level 1 certified</li>
                      <li>• 256-bit SSL encryption</li>
                      <li>• Fraud detection</li>
                      <li>• Secure tokenization</li>
                    </ul>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">5. Refund Processing Timeline</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <div className="bg-gradient-to-r from-[#F6F6F6] to-white rounded-lg p-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#9E005C] text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                      <span>Refund request submitted</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#FF4D94] text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                      <span>Request reviewed (1-2 business days)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#3F2B96] text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                      <span>Refund processed via Razorpay (3-5 business days)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                      <span>Amount credited to your account</span>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">6. Contact Support</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  For any questions about cancellations, refunds, or payment issues:
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
                  <p>
                    <strong>Live Chat:</strong> Available in your account dashboard
                  </p>
                </div>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>For any issues in utilizing our services you may contact our helpdesk on 9998198868 or services@atsnai.com</strong>
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">7. Terms and Conditions</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                This refund and cancellation policy is subject to our Terms and Conditions. 
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

export default CancellationAndRefunds;
