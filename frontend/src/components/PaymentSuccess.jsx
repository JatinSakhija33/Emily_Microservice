import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionAPI } from '../services/subscription';
import { onboardingAPI } from '../services/onboarding';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Processing your payment...');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get payment parameters from URL
        const paymentId = searchParams.get('razorpay_payment_id');
        const paymentLinkId = searchParams.get('razorpay_payment_link_id');
        const paymentStatus = searchParams.get('razorpay_payment_link_status');
        const signature = searchParams.get('razorpay_signature');

        console.log('Payment success parameters:', {
          paymentId,
          paymentLinkId,
          paymentStatus,
          signature
        });

        if (paymentStatus === 'paid' && paymentId) {
          setStatus('success');
          setMessage('Payment successful! Your subscription is now active.');
          
          // Start countdown to redirect
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                // Check if user has completed onboarding
                checkUserStatus();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          return () => clearInterval(timer);
        } else {
          setStatus('error');
          setMessage('Payment verification failed. Please contact support if you were charged.');
        }
      } catch (error) {
        console.error('Payment processing error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your payment. Please contact support.');
      }
    };

    processPayment();
  }, [searchParams]);

  const checkUserStatus = async (retryCount = 0) => {
    try {
      console.log(`🔍 Checking user status after payment... (attempt ${retryCount + 1})`);
      
      // Check subscription status
      const subResponse = await subscriptionAPI.getSubscriptionStatus();
      console.log('📊 Subscription status response:', subResponse.data);
      
      if (subResponse.data.has_active_subscription) {
        console.log('✅ User has active subscription, checking onboarding...');
        
        // Check onboarding status
        const onboardingResponse = await onboardingAPI.getOnboardingStatus();
        console.log('📋 Onboarding status response:', onboardingResponse.data);
        
        if (onboardingResponse.data.onboarding_completed) {
          console.log('🎯 User completed onboarding, redirecting to dashboard');
          // User has subscription and completed onboarding - go to dashboard
          navigate('/dashboard');
        } else {
          console.log('📝 User needs profile setup, redirecting to edit profile page');
          // User has subscription but needs profile setup
          navigate('/edit-profile');
        }
      } else {
        // If no active subscription and we haven't retried too many times, wait and retry
        if (retryCount < 3) {
          console.log(`⏳ No active subscription yet, waiting 2 seconds before retry ${retryCount + 1}/3...`);
          setTimeout(() => {
            checkUserStatus(retryCount + 1);
          }, 2000);
        } else {
          console.log('❌ No active subscription after retries, redirecting to subscription page');
          // No active subscription - go back to subscription page
          navigate('/subscription');
        }
      }
    } catch (error) {
      console.error('💥 Error checking user status:', error);
      
      // If we haven't retried too many times, wait and retry
      if (retryCount < 3) {
        console.log(`⏳ Error occurred, waiting 2 seconds before retry ${retryCount + 1}/3...`);
        setTimeout(() => {
          checkUserStatus(retryCount + 1);
        }, 2000);
      } else {
        console.log('🔄 Defaulting to dashboard due to repeated errors');
        // Default to dashboard on error
        navigate('/dashboard');
      }
    }
  };

  const handleContinue = () => {
    checkUserStatus();
  };

  const handleRetry = () => {
    navigate('/subscription');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'processing' && (
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          )}
          {status === 'error' && (
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          )}
        </div>

        {/* Status Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {status === 'processing' && 'Processing Payment...'}
          {status === 'success' && 'Payment Successful!'}
          {status === 'error' && 'Payment Failed'}
        </h1>

        <p className="text-gray-600 mb-6">
          {message}
        </p>

        {/* Payment Details */}
        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-green-800">
              <p className="font-medium">Payment ID: {searchParams.get('razorpay_payment_id')}</p>
              <p>Status: Paid</p>
            </div>
          </div>
        )}

        {/* Countdown */}
        {status === 'success' && countdown > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500">
              Redirecting in {countdown} seconds...
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === 'success' && (
            <div className="space-y-3">
              <button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center"
              >
                Continue to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center"
              >
                Go to Onboarding
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition-all duration-300"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-sm text-gray-500">
              Please wait while we process your payment...
            </div>
          )}
        </div>

        {/* Support Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@atsnai.com" className="text-pink-600 hover:text-pink-700">
              support@atsnai.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
