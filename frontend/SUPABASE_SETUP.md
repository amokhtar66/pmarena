# Supabase Setup Guide

This guide explains how to set up Supabase for authentication and database functionality for this application.

## 1. Create a Supabase Project

1. Sign up or log in to [Supabase](https://supabase.com/)
2. Create a new project from your dashboard
3. Choose a name and secure password (make sure to save this password!)
4. Select a region closest to your users
5. Wait for the database to be provisioned (this may take a few minutes)

## 2. Configure Email Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. For development, you can disable email confirmation by turning off "Confirm email" option
4. Configure any other authentication settings as needed:
   - You can customize email templates
   - Set password strength requirements
   - Configure redirect URLs

## 3. Set Up the Database Schema

1. Go to the **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Copy and paste the contents of `lib/supabase-schema.sql` into the editor
4. Run the query to create the required tables and functions

## 4. Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** key: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5. Configure Your Application

1. Create a `.env.local` file in the project root (if it doesn't exist)
2. Add the following environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## Testing Authentication

Once set up:
1. Go to `/auth` route to test the sign-up process
2. Create an account with display name, email, and password
3. You should be redirected to the home page after successful authentication

## Database Structure

The application uses the following database structure:

### Profiles Table
- `id`: UUID (matches the Supabase auth.users id)
- `display_name`: Text
- `email`: Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

This table is automatically populated when a user signs up through the auth trigger function.

## Future Considerations

For storing video recordings and report links, you'll want to:

1. Create additional tables for these resources
2. Set up appropriate storage buckets in Supabase for video files
3. Establish relationships to the user profile

Example tables you might add later:
- `videos`: To store metadata about video recordings
- `reports`: To store report links and related information 