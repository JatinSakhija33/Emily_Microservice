import { supabase } from '../lib/supabase'

export const onboardingAPI = {
  getProfile: async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) throw error
    return { data }
  },
  
  submitOnboarding: async (data) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Ensure onboarding_type is set
    const submissionData = {
      ...data,
      onboarding_type: data.onboarding_type || 'business', // Default to business if not specified
      onboarding_completed: true
    }
    
    const { data: result, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: user.user_metadata?.name || user.email,
        ...submissionData
      })
      .select()
      .single()
    
    if (error) throw error
    return { data: { message: 'Onboarding completed successfully', profile: result } }
  },
  
  getOnboardingStatus: async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) throw error
    return { data: { onboarding_completed: data?.onboarding_completed || false } }
  },

  updateProfile: async (data) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      console.log('Updating profile for user:', user.id)
      console.log('Update data:', data)
      
      // Preserve onboarding_type if it exists, otherwise keep existing value
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      }
      
      // If onboarding_type is provided, include it; otherwise don't overwrite
      if (data.onboarding_type) {
        updateData.onboarding_type = data.onboarding_type
      }
      
      const { data: result, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: user.user_metadata?.name || user.email,
          ...updateData
        })
        .select()
        .single()
      
      console.log('Update result:', result)
      console.log('Update error:', error)
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Profile updated successfully')
      return { data: { message: 'Profile updated successfully', profile: result } }
    } catch (err) {
      console.error('Error in updateProfile API:', err)
      throw err
    }
  },
}
