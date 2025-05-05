# Backblaze B2 Storage Implementation for LiveKit Egress

This implementation allows you to use Backblaze B2 Storage for storing LiveKit Egress recordings. Backblaze B2 is a cost-effective and reliable cloud storage solution that is compatible with the S3 API.

## Features

- Direct uploads to Backblaze B2 using AWS SDK v3
- Compatible with LiveKit Egress recordings
- Support for both public and private buckets
- Environment variable configuration
- Optional Supabase metadata logging (separate from storage)

## Setup Instructions

### 1. Create a Backblaze B2 Account and Bucket

1. Sign up for a [Backblaze B2 account](https://www.backblaze.com/b2/sign-up.html)
2. Create a new bucket in the Backblaze B2 dashboard
   - **Bucket Privacy**: 
     - **Public bucket** (recommended): Files are accessible without authentication (use when you want to share videos publicly)
     - **Private bucket**: Files require authentication to access (use for confidential recordings)

### 2. Generate Application Keys

1. In the Backblaze B2 dashboard, go to "App Keys"
2. Create a new application key with access to your specific bucket
3. Save the generated **keyID** and **applicationKey** securely

### 3. Configure Environment Variables

Update your environment variables with the Backblaze B2 configuration:

```
# Storage Provider Configuration
STORAGE_PROVIDER=BACKBLAZE
IS_PUBLIC_BUCKET=true  # Set to 'true' for public buckets, 'false' for private

# Backblaze B2 Configuration
STORAGE_ACCESS_KEY=your_backblaze_key_id
STORAGE_SECRET_KEY=your_backblaze_application_key
STORAGE_BUCKET=your_backblaze_bucket_name
STORAGE_ENDPOINT=https://s3.us-west-002.backblazeb2.com
STORAGE_REGION=us-west-002

# LiveKit Configuration (existing)
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=your_livekit_url

# Optional Supabase logging (if you want to track recordings in a database)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Notes:
- For `STORAGE_ENDPOINT`, use the appropriate endpoint for your region
- For `STORAGE_REGION`, use the region where your bucket is located (usually `us-west-002`)
- For `IS_PUBLIC_BUCKET`, set to `true` if your bucket has public access enabled, or `false` for private buckets

### 4. Public vs. Private Buckets

#### Public Buckets (`IS_PUBLIC_BUCKET=true`)

**Advantages:**
- Simpler architecture
- Videos can be embedded directly in web pages
- No authentication complexity
- Ideal for sharing content on your website

**How it works:**
- When set to `true`, the system generates direct URLs to your files
- Files can be accessed by anyone with the URL
- URLs follow this format: `https://f002.backblazeb2.com/file/your-bucket-name/your-file-name.mp4`

#### Private Buckets (`IS_PUBLIC_BUCKET=false`)

**Advantages:**
- More secure
- Control over who can access the content
- Ideal for private or confidential content

**How it works:**
- When set to `false`, the system generates signed URLs that expire after 7 days
- Each URL contains authentication tokens
- After expiration, a new signed URL must be generated

**Note:** Even with public buckets, files are only accessible via their exact URLs, providing some level of obscurity.

### 5. Accessing Files in Backblaze B2

You can also configure a custom domain for your bucket in the Backblaze B2 dashboard for a more professional appearance.

## Debugging

If you encounter issues with your Backblaze B2 setup:

1. Check the server logs for error messages
2. Verify your bucket permissions and application key settings
3. For private buckets, ensure you're using the signed URLs
4. Try the `LIVEKIT_S3` storage provider to see if LiveKit's direct S3 upload works

## AWS SDK Dependencies

This implementation uses the AWS SDK v3 for JavaScript. Make sure your project has the following dependencies installed:

```json
"dependencies": {
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/s3-request-presigner": "^3.x"
}
```

## Storage Provider Options

The system supports multiple storage providers through the `STORAGE_PROVIDER` environment variable:

- `LIVEKIT_S3`: Uses LiveKit's built-in S3Upload implementation (default)
- `BACKBLAZE`: Uses the custom Backblaze B2 implementation
- `SUPABASE`: Uses the Supabase Storage implementation 