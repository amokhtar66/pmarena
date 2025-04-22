"use client"

import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Auth() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') !== 'signin')
  const [message, setMessage] = useState<string | null>(null)

  // Update URL when mode changes
  useEffect(() => {
    const mode = isSignUp ? 'signup' : 'signin'
    console.log(`Auth mode: ${mode}`)
    
    // Create a URL with the updated mode parameter
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    window.history.pushState({}, '', url);
  }, [isSignUp])

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    
    try {
      console.log('Attempting to sign up with:', email, displayName)
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      })

      if (error) throw error
      
      // Show confirmation message and switch to sign-in view
      setMessage("Please check your email for the confirmation link. You need to confirm your email before signing in.")
      setIsSignUp(false)
      
      // Clear the form fields except email for easier sign-in
      setPassword('')
      
    } catch (err: any) {
      setError(err?.message || 'An error occurred during sign up')
      console.error('Error signing up:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    console.log('Sign-in button clicked')
    setLoading(true)
    setError(null)
    setMessage(null)
    
    try {
      console.log('Attempting to sign in with:', email)
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Sign-in response:', data ? 'Success' : 'Failed', error || '')
      
      if (error) throw error
      
      console.log('Sign-in successful, redirecting to home')
      
      // Force a hard navigation to the home page with noRedirect flag
      window.location.replace('/?noRedirect=true')
    } catch (err: any) {
      console.error('Sign-in error details:', err)
      // Check if this is an email confirmation error
      if (err?.message?.includes('email') && err?.message?.includes('confirm')) {
        setError('Please verify your email address before signing in. Check your inbox for the confirmation link.')
      } else {
        setError(err?.message || 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp)
    setError(null)
    setMessage(null)
    // Clear form fields when toggling
    setPassword('')
  }

  // Check if user is already authenticated
  useEffect(() => {
    let isSubscribed = true;
    
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      
      if (data.session && isSubscribed) {
        console.log('User already authenticated, redirecting to home')
        router.push('/')
      }
    }
    
    checkAuth()
    
    return () => {
      isSubscribed = false;
    }
  }, [router])

  return (
    <div className="auth-container bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <div className="auth-form">
        <h2 className="text-2xl font-bold mb-6 text-center">{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div>
          {isSignUp && (
            <div className="form-group mb-4">
              <label htmlFor="displayName" className="block text-gray-700 mb-2">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          <div className="form-group mb-4">
            <label htmlFor="email" className="block text-gray-700 mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="form-group mb-6">
            <label htmlFor="password" className="block text-gray-700 mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button 
            type="button" 
            onClick={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
        
        <div className="auth-toggle mt-4 text-center">
          <button 
            type="button"
            onClick={toggleAuthMode}
            className="text-blue-600 hover:text-blue-800"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  )
} 