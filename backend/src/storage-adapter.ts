// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck - Suppress TypeScript errors for now

import { 
  S3Upload, 
  EncodedFileType, 
  EncodedFileOutput 
} from 'livekit-server-sdk';

import { BackblazeStorageConfig } from './backblaze-storage.js';

// Feature flag - set this to indicate which storage provider to use
// Options: 'LIVEKIT_S3', 'SUPABASE', 'BACKBLAZE'
export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'LIVEKIT_S3';

// Whether the bucket is public (for direct URL access) or private (requiring signed URLs)
// Public buckets are simpler for sharing videos, private buckets are more secure
export const IS_PUBLIC_BUCKET = process.env.IS_PUBLIC_BUCKET === 'true';

/**
 * Creates a storage configuration object based on the selected storage provider
 * This allows easy switching between LiveKit S3Upload and Backblaze B2
 */
export function createStorageConfig(
  accessKey: string,
  secret: string,
  endpoint: string,
  bucket: string,
  region: string = '',
  filepath?: string
): { fileOutput: EncodedFileOutput; backblazeConfig?: BackblazeStorageConfig } {
  
  // Common configuration used by both implementations
  const backblazeConfig: BackblazeStorageConfig = {
    accessKey,
    secret,
    endpoint,
    bucket,
    region,
    filepath,
    isPublicBucket: IS_PUBLIC_BUCKET
  };
  
  // If using Backblaze B2 Storage directly
  if (STORAGE_PROVIDER === 'BACKBLAZE') {
    console.log(`Using Backblaze B2 Storage for uploads (Public bucket: ${IS_PUBLIC_BUCKET})`);
    
    // Create a local output file configuration
    // The actual upload to Backblaze will happen in a post-processing step
    const localPath = filepath || `temp-recording-${Date.now()}.mp4`;
    
    return {
      fileOutput: new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: localPath,
      }),
      backblazeConfig
    };
  }
  
  // If using LiveKit's S3Upload (default)
  console.log(`Using LiveKit S3Upload for uploads (STORAGE_PROVIDER set to ${STORAGE_PROVIDER})`);
  
  // Create a standard S3Upload configuration
  const s3UploadConfig = new S3Upload({
    accessKey,
    secret,
    region,  // For Backblaze, this should be the region like 'us-west-002'
    endpoint,
    bucket,
    forcePathStyle: true,
    // Disable multipart uploads for better compatibility
    multipartUpload: false,
    // Set high threshold to prevent multipart upload
    multipartThreshold: 5368709120, // 5GB
  });
  
  return {
    fileOutput: new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: filepath || `recording-${Date.now()}.mp4`,
      output: {
        case: 's3',
        value: s3UploadConfig,
      },
    }),
    backblazeConfig: undefined
  };
}
