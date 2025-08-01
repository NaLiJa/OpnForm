<template>
  <div 
    v-if="shouldShowOneTap"
    id="g_id_onload"
    :data-client_id="googleClientId"
    :data-context="context"
    :data-cancel_on_tap_outside="false"
    data-use_fedcm_for_prompt="false"
  />
</template>

<script setup>
const { context = 'signin' } = defineProps({
  context: {
    type: String,
    default: 'signin'
  }
})

// Use a global state to track script loading status
const scriptLoaded = useState('google-one-tap-script-loaded', () => false)

const { data: user } = useAuth().user()
const { widgetCallback } = useOAuth()
const widgetCallbackMutation = widgetCallback()
const oneTapInitialized = ref(false)
const googleClientId = computed(() => useFeatureFlag('services.google.client_id'))
const authFlow = useAuthFlow()
const router = useRouter()

// Only show One Tap if Google auth is enabled and user is not authenticated
const shouldShowOneTap = computed(() => {
  return !user.value && 
         useFeatureFlag('services.google.auth') && 
         !useFeatureFlag('self_hosted') &&
         googleClientId.value &&
         scriptLoaded.value
})

const loadGoogleScript = () => {
  if (!googleClientId.value || scriptLoaded.value) {
    if (scriptLoaded.value) {
      initializeOneTap()
    }
    return
  }

  // Use a global promise to ensure the script is only loaded once
  if (!window._googleOneTapLoadPromise) {
    window._googleOneTapLoadPromise = new Promise((resolve, reject) => {
      // Double-check if script was added by another instance
      const existingScript = document.getElementById('google-one-tap-script')
      if (existingScript && window.google?.accounts?.id) {
        return resolve()
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.id = 'google-one-tap-script'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
      
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google One Tap script'))
    })
  }
  
  window._googleOneTapLoadPromise.then(() => {
    if (window.google?.accounts?.id) {
      scriptLoaded.value = true
      initializeOneTap()
    } else {
      console.error('Google One Tap script loaded but API not available.')
    }
  }).catch((error) => {
    console.error(error)
  })
}

const initializeOneTap = () => {
  if (!window.google?.accounts?.id || !shouldShowOneTap.value || oneTapInitialized.value) return

  oneTapInitialized.value = true

  try {
    window.google.accounts.id.initialize({
      client_id: googleClientId.value,
      callback: handleCredentialResponse,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: false, // Temporarily disabled for testing
      auto_select: false,
      ux_mode: 'popup'
    })

    // Show the One Tap prompt - FedCM compliant (no status checking)
    window.google.accounts.id.prompt()
  } catch (error) {
    console.error('Google One Tap initialization failed:', error)
    
    // Reset the flag so we can try again later
    oneTapInitialized.value = false
  }
}

const handleAuthenticationResponse = async (response) => {
  try {
    // Handle authentication flow (user was not logged in)
    await authFlow.handleAuthSuccess(response, 'google_one_tap', response.new_user)
    
    if (!response.new_user) {
      // Handle existing user login
      useAlert().success('Successfully signed in with Google!')
      
      // Redirect to home if no specific redirect
      router.push({ name: "home" })
    } else {
      // Handle new user registration
      router.push({ name: "forms-create" })
      useAlert().success("You're now registered with your Google account! Welcome to OpnForm.")
      useAlert().success("Time to create your first form!")
    }
  } catch (error) {
    console.error('Google One Tap auth flow error:', error)
    useAlert().error('Authentication failed')
  }
}



const handleCredentialResponse = (response) => {
  if (!response.credential) {
    console.error('Google One Tap: No credential in response')
    useAlert().error('Google One Tap authentication failed')
    return
  }

  // Send JWT to backend widget callback
  widgetCallbackMutation.mutateAsync({
    service: 'google_one_tap',
    data: { 
      credential: response.credential,
      intent: 'auth'
    }
  }).then((response) => {
    // Handle both authentication and integration responses
    if (response.token) {
      // Authentication flow - user was not logged in
      handleAuthenticationResponse(response)
    } else {
      useAlert().error('Google One Tap authentication failed')
    }
  }).catch((error) => {
    console.error('Google One Tap authentication error:', error)
    useAlert().error(error.response?.data?.message || 'Google One Tap authentication failed')
  })
}

// Initialize when component is mounted
onMounted(() => {
  if (import.meta.client) {
    loadGoogleScript()
  }
})

// Watch for changes in shouldShowOneTap to re-initialize
watch(shouldShowOneTap, (newVal) => {
  if (newVal && scriptLoaded.value) {
    nextTick(() => {
      initializeOneTap()
    })
  }
})

// Watch for user changes to reset One Tap
watch(user, (newUser) => {
  if (newUser) {
    // User logged in, reset One Tap flag
    oneTapInitialized.value = false
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.cancel()
  }
  oneTapInitialized.value = false
})
</script> 