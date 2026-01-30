import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Calendar, Target, Globe, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import SideNavbar from './SideNavbar';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '');

const GOALS = [
    { value: 'brand_awareness', label: 'Brand Awareness', desc: 'Maximize reach & impressions' },
    { value: 'lead_generation', label: 'Lead Generation', desc: 'Collect emails & potential clients' },
    { value: 'enrollments', label: 'Enrollments', desc: 'Drive signups for courses/events' },
    { value: 'direct_sales', label: 'Direct Sales', desc: 'Promote products to buyers' },
    { value: 'community_growth', label: 'Community Growth', desc: 'Increase followers & engagement' }
];

const PLATFORMS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' }
];

const FREQUENCIES = [
    { value: '1-2', label: 'Low (1-2x / week)', desc: 'Maintenance mode' },
    { value: '3-4', label: 'Recommended (3-4x / week)', desc: 'Consistent growth' },
    { value: '5-6', label: 'High (5-6x / week)', desc: 'Aggressive scaling' },
    { value: 'daily', label: 'Daily (7x / week)', desc: 'Maximum visibility' }
];

const Step1_Basics = ({ formData, handleInputChange }) => (
    <div className="space-y-6 animate-fadeIn">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campaign Name</label>
            <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g. Summer Launch 2026"
                className="w-full p-3 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                autoFocus
            />
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Primary Goal</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {GOALS.map(g => (
                    <div
                        key={g.value}
                        onClick={() => handleInputChange('goal', g.value)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${formData.goal === g.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                            }`}
                    >
                        <div className="font-semibold text-gray-900 dark:text-white">{g.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{g.desc}</div>
                    </div>
                ))}
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campaign Description</label>
            <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="What are asking people to do? Who is this for? Any special offers?"
                rows={4}
                className="w-full p-3 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
        </div>
    </div>
);

const Step2_Schedule = ({ formData, handleInputChange }) => {
    // Helper to validate date
    const isValidEndDate = !formData.end_date || new Date(formData.end_date) >= new Date(formData.start_date);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                    <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                        className="w-full p-3 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                    <input
                        type="date"
                        value={formData.end_date}
                        min={formData.start_date}
                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                        className={`w-full p-3 rounded-lg border ${!isValidEndDate ? 'border-red-500 ring-1 ring-red-500' : 'dark:border-gray-700'} dark:bg-gray-800 dark:text-white`}
                        required
                    />
                    {!isValidEndDate && (
                        <p className="text-red-500 text-xs mt-1">End date must be after start date</p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Posting Frequency</label>
                <div className="space-y-3">
                    {FREQUENCIES.map(f => (
                        <div
                            key={f.value}
                            onClick={() => handleInputChange('frequency', f.value)}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer ${formData.frequency === f.value
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${formData.frequency === f.value ? 'border-purple-600 bg-purple-600' : 'border-gray-400'
                                }`}>
                                {formData.frequency === f.value && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">{f.label}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Step3_Platforms = ({ formData, togglePlatform }) => {
    const days = Math.max(0, Math.ceil((new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24)));

    return (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Select Platforms</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PLATFORMS.map(p => (
                        <div
                            key={p.value}
                            onClick={() => togglePlatform(p.value)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center text-center h-32 ${formData.platforms.includes(p.value)
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                }`}
                        >
                            <div className={`w-6 h-6 rounded-full mb-2 flex items-center justify-center ${formData.platforms.includes(p.value) ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                                }`}>
                                <Globe className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{p.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="flex items-center text-blue-800 dark:text-blue-300 font-semibold mb-2">
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Summary
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                    We will generate a <strong>{days}-day</strong> campaign
                    targeting <strong>{formData.goal ? GOALS.find(g => g.value === formData.goal).label : 'your goal'}</strong>.
                    <br />
                    Approximately <strong>{Math.floor(days / 7 * (formData.frequency === 'daily' ? 7 : 3.5)) * formData.platforms.length}</strong> posts
                    will be scheduled across {formData.platforms.length || 'selected'} platforms.
                </p>
            </div>
        </div>
    );
};

const OrganicCampaignWizard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useNotifications();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        goal: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        frequency: '3-4',
        platforms: []
    });

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const togglePlatform = (plat) => {
        setFormData(prev => {
            const current = prev.platforms;
            if (current.includes(plat)) return { ...prev, platforms: current.filter(p => p !== plat) };
            return { ...prev, platforms: [...current, plat] };
        });
    };

    const getAuthToken = async () => {
        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
        return session?.access_token || localStorage.getItem('authToken');
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const token = await getAuthToken();
            if (!token) throw new Error('Not authenticated');

            const payload = {
                ...formData,
                user_id: user.id
            };

            const res = await fetch(`${API_BASE_URL}/organic-campaign/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to create campaign');
            }

            const data = await res.json();
            showSuccess('Campaign Created!', `Generated ${data.post_count} posts successfully.`);
            navigate('/calendars?refresh=true');

        } catch (err) {
            console.error(err);
            showError('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <SideNavbar />

            <div className="flex-1 flex flex-col overflow-y-auto ml-64">
                <div className="max-w-3xl mx-auto w-full p-8">

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Organic Campaign</h1>
                        <p className="text-gray-500 dark:text-gray-400">Design a strategic content calendar driven by your business goals.</p>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center justify-between mb-8 relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10 rounded"></div>
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`flex items-center justify-center w-10 h-10 rounded-full border-4 ${step >= s
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                                }`}>
                                {step > s ? <Check className="w-5 h-5" /> : <span>{s}</span>}
                            </div>
                        ))}
                    </div>

                    {/* Form Area */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 min-h-[400px]">
                        {step === 1 && <Step1_Basics formData={formData} handleInputChange={handleInputChange} />}
                        {step === 2 && <Step2_Schedule formData={formData} handleInputChange={handleInputChange} />}
                        {step === 3 && <Step3_Platforms formData={formData} togglePlatform={togglePlatform} />}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-between mt-8">
                        <button
                            onClick={() => step > 1 ? setStep(step - 1) : navigate('/calendars')}
                            className="px-6 py-3 rounded-lg font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>

                        {step < 3 ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={step === 1 && (!formData.name || !formData.goal) || (step === 2 && (!formData.start_date || !formData.end_date || new Date(formData.end_date) < new Date(formData.start_date)))}
                                className="flex items-center px-8 py-3 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading || formData.platforms.length === 0}
                                className="flex items-center px-8 py-3 rounded-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                                Generate Campaign
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default OrganicCampaignWizard;
