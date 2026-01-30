import React, { useState, useEffect } from 'react';
import { X, Clock, Gift } from 'lucide-react';
import { migrationAPI } from '../services/migration';

const MigrationBanner = () => {
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkMigrationStatus = async () => {
      try {
        const response = await migrationAPI.getMigrationStatus();
        setMigrationStatus(response.data.migration_info);
        
        if (response.data.migration_info.needs_migration) {
          setShowBanner(true);
        }
      } catch (error) {
        console.error('Error checking migration status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkMigrationStatus();
  }, []);

  const handleSubscribe = () => {
    window.location.href = '/subscription';
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Store dismissal in localStorage to not show again for this session
    localStorage.setItem('migration_banner_dismissed', 'true');
  };

  // Don't show if loading or already dismissed
  if (isLoading || !showBanner || !migrationStatus) {
    return null;
  }

  // Check if banner was dismissed in this session
  if (localStorage.getItem('migration_banner_dismissed')) {
    return null;
  }

  const daysLeft = migrationStatus.days_left || 0;
  const isUrgent = daysLeft <= 7;

  return (
    <div className={`relative overflow-hidden ${
      isUrgent 
        ? 'bg-gradient-to-r from-red-500 to-red-600' 
        : 'bg-gradient-to-r from-[#FF4D94] to-[#9E005C]'
    } text-white`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {isUrgent ? (
                <Clock className="w-6 h-6 text-white" />
              ) : (
                <Gift className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {isUrgent ? '⏰ Limited Time Left!' : '🎉 You\'re a valued early user!'}
              </h3>
              <p className="text-sm">
                {isUrgent ? (
                  <>
                    Only <span className="font-bold">{daysLeft} days</span> left of free access. 
                    Subscribe now to continue enjoying Emily's full features.
                  </>
                ) : (
                  <>
                    You have <span className="font-bold">{daysLeft} days</span> left of free access. 
                    Subscribe now to continue enjoying Emily's full features.
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSubscribe}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                isUrgent
                  ? 'bg-white text-red-600 hover:bg-gray-100'
                  : 'bg-white text-[#9E005C] hover:bg-gray-100'
              }`}
            >
              Subscribe Now
            </button>
            <button 
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
              title="Dismiss for this session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      {daysLeft > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div 
            className={`h-full transition-all duration-300 ${
              isUrgent ? 'bg-red-200' : 'bg-white/50'
            }`}
            style={{ 
              width: `${Math.max(0, Math.min(100, (30 - daysLeft) / 30 * 100))}%` 
            }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default MigrationBanner;
