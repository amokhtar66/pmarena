// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck - Suppress TypeScript errors for now

import { EgressClient, EgressInfo, RoomCompositeEgressRequest } from 'livekit-server-sdk';
import { uploadToBackblazeStorage, BackblazeStorageConfig } from './backblaze-storage';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration for the egress listener
interface EgressListenerConfig {
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  recordingsTable?: string; // Optional table name for recording metadata
}

/**
 * EgressListener class to handle LiveKit egress events and post-processing
 * Particularly useful when using Backblaze B2 directly
 */
export class EgressListener {
  private egressClient: EgressClient;
  private supabaseAdmin: ReturnType<typeof createClient> | null = null;
  private recordingsTable: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private processingEgressIds = new Set<string>();
  private backblazeConfigs = new Map<string, BackblazeStorageConfig>();

  constructor(private config: EgressListenerConfig) {
    this.egressClient = new EgressClient(
      config.livekitUrl,
      config.livekitApiKey,
      config.livekitApiSecret
    );
    
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      this.supabaseAdmin = createClient(
        config.supabaseUrl,
        config.supabaseServiceRoleKey
      );
    }
    
    this.recordingsTable = config.recordingsTable || 'recordings';
  }

  /**
   * Register a Backblaze config for a specific egress ID
   * This allows us to match egress recordings with their Backblaze destination
   */
  registerBackblazeConfig(egressId: string, config: BackblazeStorageConfig) {
    this.backblazeConfigs.set(egressId, config);
  }

  /**
   * Start listening for egress events
   * This polls the LiveKit API for egress info and processes completed recordings
   */
  startListening(pollIntervalMs = 10000) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.pollingInterval = setInterval(async () => {
      try {
        // Get all active egress info
        const response = await this.egressClient.listEgress();
        
        // Process each egress item - Note: listEgress returns a different structure than documented
        if (!response || !Array.isArray(response)) {
          return;
        }
        
        // Process each egress item
        for (const egressInfo of response) {
          await this.processEgressItem(egressInfo);
        }
      } catch (error) {
        console.error('Error polling egress info:', error);
      }
    }, pollIntervalMs);
    
    console.log(`Egress listener started, polling every ${pollIntervalMs}ms`);
  }

  /**
   * Stop listening for egress events
   */
  stopListening() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Process a single egress item
   * This handles uploading completed recordings to Backblaze B2
   */
  private async processEgressItem(egressInfo: EgressInfo) {
    // Only process completed recordings - EgressStatus is an enum
    if (egressInfo.status !== 2 || // 2 = EGRESS_COMPLETE in the EgressStatus enum
        !egressInfo.egressId ||
        this.processingEgressIds.has(egressInfo.egressId)) {
      return;
    }
    
    // Mark as processing to prevent duplicate processing
    this.processingEgressIds.add(egressInfo.egressId);
    
    try {
      console.log(`Processing completed egress: ${egressInfo.egressId}`);
      
      // Check if we have a registered Backblaze config for this egress
      const backblazeConfig = this.backblazeConfigs.get(egressInfo.egressId);
      
      if (!backblazeConfig) {
        console.log(`No Backblaze config found for egress ${egressInfo.egressId}, skipping upload`);
        return;
      }
      
      // Find the local file path from the egress info
      const localFilePath = this.findLocalFilePath(egressInfo);
      
      if (!localFilePath) {
        console.error(`Could not find local file for egress ${egressInfo.egressId}`);
        return;
      }
      
      // Upload the file to Backblaze B2
      const { url } = await uploadToBackblazeStorage(localFilePath, backblazeConfig);
      
      console.log(`Successfully uploaded ${localFilePath} to Backblaze B2`);
      console.log(`Public URL: ${url}`);
      
      // Store recording info in Supabase if available
      if (this.supabaseAdmin) {
        await this.storeRecordingInfo(egressInfo, url);
      }
      
      // Clean up the local file
      this.cleanupLocalFile(localFilePath);
      
    } catch (error) {
      console.error(`Error processing egress ${egressInfo.egressId}:`, error);
    } finally {
      // Remove from processing set
      this.processingEgressIds.delete(egressInfo.egressId);
    }
  }

  /**
   * Find the local file path from egress info
   */
  private findLocalFilePath(egressInfo: any): string | null {
    // The file might be available at different paths depending on how LiveKit exposes it
    // Check for various possible locations where the file might be stored
    if (egressInfo.file?.location) {
      return egressInfo.file.location;
    }
    
    // Second option: output property structure
    if (egressInfo.output?.file?.location) {
      return egressInfo.output.file.location;
    }
    
    // Another option depending on SDK version
    if (egressInfo.fileResults && egressInfo.fileResults.length > 0) {
      return egressInfo.fileResults[0].location;
    }
    
    // Fallback to looking for a file property in the top level
    if (egressInfo.location) {
      return egressInfo.location;
    }
    
    return null;
  }

  /**
   * Store recording info in Supabase
   */
  private async storeRecordingInfo(egressInfo: EgressInfo, url: string) {
    if (!this.supabaseAdmin) {
      return;
    }
    
    try {
      const { error } = await this.supabaseAdmin
        .from(this.recordingsTable)
        .insert({
          egress_id: egressInfo.egressId,
          room_name: egressInfo.roomName,
          url: url,
          status: 'complete',
          created_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error('Error storing recording info in Supabase:', error);
      }
    } catch (error) {
      console.error('Error storing recording info in Supabase:', error);
    }
  }

  /**
   * Clean up local file after processing
   */
  private cleanupLocalFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up local file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up local file ${filePath}:`, error);
    }
  }
}
