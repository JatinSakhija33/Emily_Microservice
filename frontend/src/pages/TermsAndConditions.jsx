import { ArrowLeft } from 'lucide-react';

const TermsAndConditions = () => {
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
              Terms and Conditions
            </span>
          </h1>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <p className="text-sm text-[#2E2E2E]/60 mb-8">
              Last updated: January 2025
            </p>

            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">1. Acceptance of Terms</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                By accessing and using atsn ai services, you accept and agree to be bound by the terms 
                and provision of this agreement. If you do not agree to abide by the above, please do 
                not use this service.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">2. Use License</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                Permission is granted to temporarily use atsn ai services for personal, non-commercial 
                transitory viewing only. This is the grant of a license, not a transfer of title, and 
                under this license you may not modify or copy the materials.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">3. Service Availability</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                We strive to provide continuous service availability, but we do not guarantee that our 
                services will be uninterrupted or error-free. We reserve the right to modify, suspend, 
                or discontinue any part of our services at any time.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">4. User Responsibilities</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                You are responsible for maintaining the confidentiality of your account and password. 
                You agree to accept responsibility for all activities that occur under your account 
                or password. You must not use our services for any unlawful purpose or any purpose 
                prohibited under this clause.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">5. Intellectual Property</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                The service and its original content, features, and functionality are and will remain 
                the exclusive property of atsn ai and its licensors. The service is protected by 
                copyright, trademark, and other laws.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">6. Limitation of Liability</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                In no event shall atsn ai, nor its directors, employees, partners, agents, suppliers, 
                or affiliates, be liable for any indirect, incidental, special, consequential, or 
                punitive damages, including without limitation, loss of profits, data, use, goodwill, 
                or other intangible losses.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">7. Termination</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                We may terminate or suspend your account and bar access to the service immediately, 
                without prior notice or liability, under our sole discretion, for any reason whatsoever 
                and without limitation, including but not limited to a breach of the Terms.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">8. Changes to Terms</h2>
              <p className="mb-6 text-[#2E2E2E]/80">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any 
                time. If a revision is material, we will provide at least 30 days notice prior to any 
                new terms taking effect.
              </p>

              <h2 className="text-2xl font-semibold mb-4 text-[#2E2E2E]">9. Contact Information</h2>
              <div className="mb-6 text-[#2E2E2E]/80">
                <p className="mb-4">
                  If you have any questions about these Terms and Conditions, please contact us at:
                </p>
                <div className="bg-[#F6F6F6] rounded-lg p-4">
                  <p className="mb-2">
                    <strong>Helpdesk Phone:</strong> <a href="tel:+919998198868" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">+91 99981 98868</a>
                  </p>
                  <p className="mb-2">
                    <strong>Helpdesk Email:</strong> <a href="mailto:services@atsnai.com" className="text-[#9E005C] hover:text-[#FF4D94] transition-colors">services@atsnai.com</a>
                  </p>
                  <p className="mb-2">
                    <strong>Legal Email:</strong> legal@atsnai.com
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

export default TermsAndConditions;
