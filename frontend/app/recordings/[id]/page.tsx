"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Recording = {
  id: string;
  user_id: string;
  room_name: string;
  egress_id: string;
  file_url: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
};

export default function RecordingPage() {
  const { id } = useParams();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function fetchRecording() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('recordings')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching recording:', error);
          setError('Failed to load recording. It may not exist or you may not have permission to view it.');
        } else if (data) {
          setRecording(data as Recording);
        } else {
          setError('Recording not found');
        }
      } catch (err) {
        console.error('Error in fetch operation:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchRecording();
    }

    // Set up a polling interval to check status if processing
    const intervalId = setInterval(async () => {
      if (recording && recording.status === 'processing') {
        const { data } = await supabase
          .from('recordings')
          .select('*')
          .eq('id', id)
          .single();
        
        if (data && data.status !== recording.status) {
          setRecording(data as Recording);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [id, recording?.status]);

  const copyLinkToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
        });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-lg font-medium">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="mb-4">{error}</p>
          <a href="/" className="text-blue-500 hover:underline">Return to home</a>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-lg font-medium">Recording not found</p>
          <a href="/" className="text-blue-500 hover:underline">Return to home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Recording Session</h1>
          <p className="text-gray-600 mb-6">
            Recorded on {new Date(recording.started_at).toLocaleString()}
          </p>

          {recording.status === 'completed' && recording.file_url ? (
            <div className="mb-6">
              <video 
                src={recording.file_url} 
                controls 
                className="w-full rounded-lg shadow"
                poster="/video-thumbnail.png" // Optional: Add a placeholder image
              />
            </div>
          ) : (
            <div className="bg-gray-100 p-8 rounded-lg text-center mb-6">
              <p className="text-lg mb-2">Recording is {recording.status}...</p>
              <p className="text-sm text-gray-500">
                {recording.status === 'processing' 
                  ? 'This may take a few minutes. The page will update automatically when ready.'
                  : 'There might be an issue with this recording.'}
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <h2 className="font-semibold text-lg mb-3">Share this recording</h2>
            <div className="flex">
              <input 
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : ''}
                className="flex-1 border rounded-l px-3 py-2 bg-gray-50"
              />
              <button 
                className={`px-4 py-2 rounded-r font-medium ${
                  copySuccess 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                onClick={copyLinkToClipboard}
              >
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 