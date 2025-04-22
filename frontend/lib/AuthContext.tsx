"use client"

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from './supabase'

interface AuthContextProps {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  checkSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  checkSession: async () => false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialCheckComplete, setInitialCheckComplete] = useState(false)
  const router = useRouter()

  const getProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (data) {
        console.log('Profile loaded:', data.display_name)
        setProfile(data as UserProfile)
      } else {
        console.log('No profile found for user')
      }
    } catch (error) {
      console.error('Error getting profile:', error)
    }
  }

  const checkSession = async (): Promise<boolean> => {
    try {
      console.log('Checking current session...')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        console.log('Valid session found:', session.user.email)
        setUser(session.user)
        await getProfile(session.user.id)
        return true
      } else {
        console.log('No valid session found')
        setUser(null)
        setProfile(null)
        return false
      }
    } catch (error) {
      console.error('Error checking session:', error)
      return false
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      if (initialCheckComplete) return;
      
      try {
        console.log('Getting initial session...')
        await checkSession()
        setInitialCheckComplete(true)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        
        if (session?.user) {
          console.log('User authenticated:', session.user.email)
          setUser(session.user)
          await getProfile(session.user.id)
        } else {
          console.log('User signed out or session expired')
          setUser(null)
          setProfile(null)
        }

        if (event === 'SIGNED_OUT') {
          router.push('/auth?mode=signin')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router, initialCheckComplete])

  const signOut = async () => {
    console.log('Signing out user...')
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/auth?mode=signin')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
} 