'use client'

import { Suspense } from 'react'
import Auth from '../../components/Auth'

export default function AuthPage() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
        <Auth />
      </Suspense>
    </div>
  )
} 