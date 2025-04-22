"use client";

import { supabase } from '@/lib/supabase';
import { useState } from 'react';

export default function AuthTest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestSignIn = async () => {
    setLoading(true);
    setResult('Attempting to sign in...');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`Success! User ID: ${data.user?.id}`);
      }
    } catch (err: any) {
      setResult(`Exception: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    setLoading(true);
    setResult('Checking session...');
    
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setResult(`Session error: ${error.message}`);
      } else if (data.session) {
        setResult(`Active session found! User: ${data.session.user.email}`);
      } else {
        setResult('No active session found');
      }
    } catch (err: any) {
      setResult(`Session check exception: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Authentication Test</h2>
      
      <div className="mb-6">
        <label className="block mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="mb-6">
        <label className="block mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="space-x-4">
        <button
          onClick={handleTestSignIn}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Sign In
        </button>
        
        <button
          onClick={checkSession}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Check Session
        </button>
      </div>
      
      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 