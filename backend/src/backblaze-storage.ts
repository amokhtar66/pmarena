// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck - Suppress TypeScript errors for now

import { EncodedFileType } from 'livekit-server-sdk';
import fs from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration interface for Backblaze B2
export interface BackblazeStorageConfig {
  bucket: string;
  endpoint: string;  // Backblaze B2 endpoint
  accessKey: string; // Backblaze B2 key ID
  secret: string;    // Backblaze B2 application key
  region: string;    // Usually 'us-west-002' for Backblaze
  filepath?: string;
  isPublicBucket?: boolean; // Whether the bucket is public (defaults to false)
}

/**
 * Generate a public URL for a file in a Backblaze B2 bucket
 * This is used for files in public buckets
 */
export function getPublicBackblazeUrl(bucket: string, fileName: string): string {
  // Format: https://f002.backblazeb2.com/file/{bucketName}/{fileName}
  return `https://f002.backblazeb2.com/file/${bucket}/${fileName}`;
}

/**
 * Uploads a file to Backblaze B2 using AWS SDK v3
 * Uses the S3-compatible API that Backblaze provides
 */
export async function uploadToBackblazeStorage(
  localFilePath: string,
  config: BackblazeStorageConfig,
  fileType: EncodedFileType = EncodedFileType.MP4
): Promise<{ url: string; egressId?: string }> {
  console.log(`Attempting to upload ${localFilePath} to Backblaze B2...`);
  
  // Extract the filename from the filepath or use the provided one
  const fileName = config.filepath || `recording-${Date.now()}.${fileType === EncodedFileType.MP4 ? 'mp4' : 'webm'}`;
  
  try {
    // Create S3 client with Backblaze configuration
    const s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secret
      },
      forcePathStyle: true, // Required for Backblaze B2
    });
    
    // Read the file as a buffer
    const fileBuffer = fs.readFileSync(localFilePath);
    
    // Create the upload command
    const putCommand = new PutObjectCommand({
      Bucket: config.bucket,
      Key: fileName,
      Body: fileBuffer,
      ContentType: fileType === EncodedFileType.MP4 ? 'video/mp4' : 'video/webm'
    });
    
    // Upload to Backblaze B2
    const response = await s3Client.send(putCommand);
    console.log('Backblaze B2 upload successful:', response);
    
    let url: string;
    
    // If public bucket, use direct URL
    if (config.isPublicBucket) {
      url = getPublicBackblazeUrl(config.bucket, fileName);
      console.log(`Generated public URL: ${url}`);
    } else {
      // For private buckets, generate a signed URL that expires in 7 days (604800 seconds)
      const getCommand = new GetObjectCommand({
        Bucket: config.bucket,
        Key: fileName
      });
      url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });
      console.log(`Generated signed URL (expires in 7 days): ${url}`);
    }
    
    return { 
      url,
      egressId: fileName // Use filename as egressId for tracking
    };
  } catch (error) {
    console.error('Error uploading to Backblaze B2:', error);
    throw error;
  }
} 