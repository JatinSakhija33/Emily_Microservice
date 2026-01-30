import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionAPI } from '../services/subscription';
import { trialAPI } from '../services/trial';
import { generateInvoicePDF, generateBillingHistoryPDF } from '../services/pdfGenerator';
import SideNavbar from './SideNavbar';
import MobileNavigation from './MobileNavigation';
import { 
  CreditCard, 
  Calendar, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  Loader2,
  Gift
} from 'lucide-react';

const BillingDashboard = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch subscription status
      const statusResponse = await subscriptionAPI.getSubscriptionStatus();
      setSubscriptionStatus(statusResponse.data);
      
      // Fetch billing history
      const historyResponse = await subscriptionAPI.getBillingHistory();
      setBillingHistory(historyResponse.data.billing_history || []);
      
      // Fetch trial information
      try {
        const trialResponse = await trialAPI.getTrialInfo();
        setTrialInfo(trialResponse.data.trial_info);
      } catch (trialError) {
        console.log('No trial information available:', trialError);
        setTrialInfo(null);
      }
      
      // Fetch user profile
      await fetchUserProfile();
      
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile for user:', user?.id);
      
      // Always use user metadata as primary source since it's more reliable
      const profileData = {
        name: user?.user_metadata?.name || user?.user_metadata?.full_name || 'Customer Name',
        email: user?.email || 'Email Address',
        business_name: user?.user_metadata?.name || user?.user_metadata?.full_name,
        subscription_plan: subscriptionStatus?.plan || 'Subscription Plan'
      };
      
      console.log('Profile data:', profileData);
      setUserProfile(profileData);
      
      // Cache the profile
      localStorage.setItem(`profile_${user?.id}`, JSON.stringify(profileData));
      
    } catch (error) {
      console.error('Error setting user profile:', error);
      // Use user metadata as fallback
      setUserProfile({
        name: user?.user_metadata?.name || user?.email || 'Customer Name',
        email: user?.email || 'Email Address',
        business_name: user?.user_metadata?.name,
        subscription_plan: subscriptionStatus?.plan || 'Subscription Plan'
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingData();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `INR ${(amount / 100).toFixed(2)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'expired':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const calculateNextPayment = (startDate, billingCycle) => {
    const start = new Date(startDate);
    const next = new Date(start);
    
    if (billingCycle === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }
    
    return next;
  };

  const handleUpgradePlan = () => {
    window.location.href = '/subscription';
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionStatus?.subscription_id) {
      alert('No active subscription to cancel');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await subscriptionAPI.cancelSubscription(subscriptionStatus.subscription_id);
      alert('Subscription cancelled successfully. You will retain access until the end of your current billing period.');
      await fetchBillingData(); // Refresh data
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportBilling = () => {
    try {
      if (!billingHistory || billingHistory.length === 0) {
        alert('No billing history available to export.');
        return;
      }

      // Generate PDF
      const pdf = generateBillingHistoryPDF(billingHistory, userProfile);
      
      // Download PDF
      pdf.save(`billing-history-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDownloadInvoice = (invoice) => {
    try {
      if (!invoice) {
        alert('Invalid invoice data.');
        return;
      }

      console.log('Generating invoice with user profile:', userProfile);
      console.log('Invoice data:', invoice);

      // Generate individual invoice PDF
      const pdf = generateInvoicePDF(invoice, billingHistory, userProfile);
      
      // Download PDF
      pdf.save(`invoice-${invoice.id}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert(`Failed to generate invoice PDF: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdatePaymentMethod = () => {
    // For now, redirect to subscription page where they can update payment
    window.location.href = '/subscription';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <SideNavbar />
        <MobileNavigation />
        
        {/* Main Content */}
        <div className="flex-1 ml-0 md:ml-48 xl:ml-64 pt-16 md:pt-0">
          {/* Header Skeleton */}
          <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3 md:py-4 lg:py-8 gap-2 md:gap-0">
                <div className="flex items-center space-x-2 md:space-x-3 lg:space-x-4 min-w-0 flex-1 pr-2">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse"></div>
                  <div className="min-w-0">
                    <div className="h-5 sm:h-6 md:h-7 lg:h-8 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-32 sm:w-40 md:w-48 mb-2 animate-pulse"></div>
                    <div className="h-3 sm:h-4 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-40 sm:w-48 md:w-64 animate-pulse hidden md:block"></div>
                  </div>
                </div>
                
                {/* Refresh Button Skeleton */}
                <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                  <div className="h-8 sm:h-9 md:h-10 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-md sm:rounded-lg md:rounded-xl w-16 sm:w-20 md:w-24 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area Skeleton */}
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
            <div className="space-y-4 md:space-y-6 lg:space-y-8">
              {/* Current Subscription Card Skeleton */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-0">
                  <div className="h-5 sm:h-6 md:h-7 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-32 sm:w-40 md:w-48 animate-pulse"></div>
                  <div className="h-7 sm:h-8 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-full w-20 sm:w-24 animate-pulse"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-16 animate-pulse"></div>
                      <div className="h-6 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-24 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing History Card Skeleton */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-0">
                  <div className="h-5 sm:h-6 md:h-7 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-28 sm:w-32 animate-pulse"></div>
                  <div className="h-8 sm:h-9 md:h-10 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-md sm:rounded-lg w-24 sm:w-28 animate-pulse"></div>
                </div>

                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-lg animate-pulse"></div>
                        <div>
                          <div className="h-4 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-32 mb-2 animate-pulse"></div>
                          <div className="h-3 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-24 animate-pulse"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="h-4 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-16 mb-2 animate-pulse"></div>
                          <div className="h-3 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-20 animate-pulse"></div>
                        </div>
                        
                        <div className="h-8 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-full w-20 animate-pulse"></div>
                        
                        <div className="h-8 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-lg w-32 animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method Card Skeleton */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-0">
                  <div className="h-5 sm:h-6 md:h-7 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-32 sm:w-40 animate-pulse"></div>
                  <div className="h-8 sm:h-9 md:h-10 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-md sm:rounded-lg w-28 sm:w-36 animate-pulse"></div>
                </div>

                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-8 bg-gradient-to-r from-purple-200 to-indigo-200 rounded animate-pulse"></div>
                  <div>
                    <div className="h-4 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-32 mb-2 animate-pulse"></div>
                    <div className="h-3 bg-gradient-to-r from-purple-200 to-indigo-200 rounded w-24 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Main Content */}
      <div className="flex-1 ml-0 md:ml-48 xl:ml-64 pt-16 md:pt-0">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3 md:py-4 lg:py-8 gap-2 md:gap-3 lg:gap-4">
              <div className="flex items-center space-x-2 md:space-x-3 lg:space-x-4 min-w-0 flex-1 pr-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-normal text-white truncate">
                    Billing & Subscription
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg hidden md:block">Manage your subscription and view billing history</p>
                </div>
              </div>
              
              <div className="flex items-center flex-shrink-0">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-3 md:px-4 lg:px-6 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="font-medium hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
          {error && (
            <div className="mb-4 md:mb-6 p-3 sm:p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg sm:rounded-xl">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mr-2 flex-shrink-0" />
                <p className="text-red-700 text-xs sm:text-sm md:text-base">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4 md:space-y-6 lg:space-y-8">
             {/* Current Subscription Card */}
             <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300">
               <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 sm:gap-3 md:gap-4">
                 <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-normal text-white flex-1 min-w-0">Current Subscription</h2>
                 <div className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium flex-shrink-0 whitespace-nowrap ${getStatusColor(subscriptionStatus?.status || 'inactive')}`}>
                   {getStatusIcon(subscriptionStatus?.status || 'inactive')}
                   <span className="capitalize">{subscriptionStatus?.status || 'Inactive'}</span>
                 </div>
               </div>

               {subscriptionStatus?.has_active_subscription ? (
                 <div className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 overflow-x-auto">
                   <div className="space-y-1 sm:space-y-1.5 flex-shrink-0 min-w-[60px] sm:min-w-[80px] md:min-w-[100px]">
                     <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Plan</p>
                     <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-semibold text-gray-900 capitalize truncate">{subscriptionStatus?.plan || 'N/A'}</p>
                   </div>
                   
                   <div className="space-y-1 sm:space-y-1.5 flex-shrink-0 min-w-[70px] sm:min-w-[90px] md:min-w-[110px]">
                     <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Started</p>
                     <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-semibold text-gray-900 truncate">
                       {subscriptionStatus?.subscription_start_date ? 
                         formatDate(subscriptionStatus.subscription_start_date) : 'N/A'}
                     </p>
                   </div>
                   
                   <div className="space-y-1 sm:space-y-1.5 flex-shrink-0 min-w-[80px] sm:min-w-[100px] md:min-w-[120px]">
                     <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Next Payment</p>
                     <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-semibold text-gray-900 truncate">
                       {subscriptionStatus?.subscription_start_date ? 
                         formatDate(calculateNextPayment(subscriptionStatus.subscription_start_date, 'monthly')) : 'N/A'}
                     </p>
                   </div>
                 </div>
              ) : (
                <div className="text-center py-6 md:py-8">
                  <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-base sm:text-lg md:text-xl font-normal text-white mb-2">No Active Subscription</h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-4 px-4">You don't have an active subscription. Choose a plan to get started.</p>
                  <button
                    onClick={() => window.location.href = '/subscription'}
                    className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base font-medium"
                  >
                    View Plans
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2" />
                  </button>
                </div>
              )}
            </div>

            {/* Trial Status Card */}
            {trialInfo && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-normal text-white">Trial Status</h2>
                  <div className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                    trialInfo.trial_active 
                      ? 'bg-blue-100 text-blue-800' 
                      : trialInfo.subscription_status === 'expired'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="capitalize">
                      {trialInfo.trial_active ? 'Active Trial' : 
                       trialInfo.subscription_status === 'expired' ? 'Trial Expired' : 
                       'No Trial'}
                    </span>
                  </div>
                </div>

                {trialInfo.trial_active ? (
                  <div className="space-y-3 md:space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg md:text-xl font-normal text-white mb-1 sm:mb-2">🎉 Free Trial Active</h3>
                          <p className="text-xs sm:text-sm md:text-base text-gray-600">
                            You have <span className="font-semibold text-blue-600">{trialInfo.days_remaining}</span> days remaining
                          </p>
                          {trialInfo.trial_expires_at && (
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                              Expires on {new Date(trialInfo.trial_expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-blue-600 flex-shrink-0">
                          <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 px-2">
                        Enjoy full access to all Emily features during your trial
                      </p>
                      <button
                        onClick={() => window.location.href = '/subscription'}
                        className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base font-medium"
                      >
                        Upgrade to Continue
                      </button>
                    </div>
                  </div>
                ) : trialInfo.subscription_status === 'expired' ? (
                  <div className="text-center py-4 md:py-6">
                    <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-orange-400 mx-auto mb-3 md:mb-4" />
                    <h3 className="text-base sm:text-lg md:text-xl font-normal text-white mb-2">Trial Expired</h3>
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-4 px-4">Your free trial has ended. Choose a plan to continue using Emily.</p>
                    <button
                      onClick={() => window.location.href = '/subscription'}
                      className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base font-medium"
                    >
                      Choose Plan
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 md:py-6">
                    <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 md:mb-4" />
                    <h3 className="text-base sm:text-lg md:text-xl font-normal text-white mb-2">No Trial Available</h3>
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-4 px-4">You have already used your free trial or have an active subscription.</p>
                  </div>
                )}
              </div>
            )}
             <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300">
               <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 sm:gap-3 md:gap-4">
                 <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-normal text-white flex-1 min-w-0">Billing History</h2>
                 <button 
                   onClick={handleExportBilling}
                   className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-gray-600 hover:text-gray-900 transition-colors rounded-md sm:rounded-lg text-xs sm:text-sm md:text-base font-medium whitespace-nowrap flex-shrink-0"
                 >
                   <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                   <span className="hidden sm:inline">Export PDF</span>
                   <span className="sm:hidden">Export</span>
                 </button>
               </div>

              {billingHistory.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {billingHistory.map((invoice) => (
                    <div key={invoice.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors gap-3 lg:gap-4">
                      <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 md:space-x-4 flex-1 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm md:text-base break-words">{invoice.description}</p>
                          <p className="text-xs sm:text-sm text-gray-500 break-all mt-0.5">Invoice #{invoice.id}</p>
                        </div>
                      </div>
                      
                       <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0 flex-wrap">
                         <div className="text-left lg:text-right min-w-[70px] sm:min-w-[80px] lg:min-w-[120px]">
                           <p className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base whitespace-nowrap">{formatCurrency(invoice.amount)}</p>
                           <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap hidden lg:block">{formatDate(invoice.date)}</p>
                         </div>
                         
                         <div className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0 ${getStatusColor(invoice.status)}`}>
                           {getStatusIcon(invoice.status)}
                           <span className="capitalize">{invoice.status}</span>
                         </div>
                         
                         <button 
                           onClick={() => handleDownloadInvoice(invoice)}
                           className="flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-gray-600 hover:text-gray-900 transition-colors text-xs sm:text-sm rounded-md sm:rounded-lg whitespace-nowrap flex-shrink-0"
                         >
                           <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                           <span className="hidden sm:inline">Download</span>
                         </button>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-base sm:text-lg md:text-xl font-normal text-white mb-2">No Billing History</h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-500 px-4">Your billing history will appear here once you make your first payment.</p>
                </div>
              )}
            </div>

             {/* Payment Method */}
             <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300">
               <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-normal text-white mb-3 md:mb-4">Payment Method</h2>
               <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
                 <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-1 min-w-0">
                   <div className="w-10 h-7 sm:w-12 sm:h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                     <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                   </div>
                   <div className="min-w-0 pr-2">
                     <p className="font-medium text-gray-900 text-xs sm:text-sm md:text-base truncate">Razorpay Payment Gateway</p>
                     <p className="text-xs sm:text-sm text-gray-500 truncate">Secure payment processing</p>
                   </div>
                 </div>
                 <button 
                   onClick={handleUpdatePaymentMethod}
                   className="px-3 sm:px-4 py-1.5 sm:py-2 text-purple-600 hover:text-purple-700 font-medium transition-colors rounded-md sm:rounded-lg text-xs sm:text-sm md:text-base whitespace-nowrap flex-shrink-0"
                 >
                   Update
                 </button>
               </div>
             </div>

            {/* Subscription Management */}
            {subscriptionStatus?.has_active_subscription && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 hover:shadow-2xl transition-all duration-300">
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-normal text-white mb-3 md:mb-4">Subscription Management</h2>
                <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-wrap gap-2">
                  <button 
                    onClick={handleUpgradePlan}
                    className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base font-medium whitespace-nowrap"
                  >
                    Upgrade Plan
                  </button>
                  <button 
                    onClick={handleCancelSubscription}
                    disabled={actionLoading}
                    className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 border border-gray-300 text-gray-700 rounded-md sm:rounded-lg md:rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm md:text-base font-medium whitespace-nowrap"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1.5 sm:mr-2 inline" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Subscription'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
