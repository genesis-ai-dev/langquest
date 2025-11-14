# Deployment Guide

This guide covers deploying LangQuest to cloud environments, specifically setting up the AI translation prediction feature and Edge Functions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Edge Function Deployment](#edge-function-deployment)
- [API Key Configuration](#api-key-configuration)
- [Security Considerations](#security-considerations)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **Supabase Project**: A Supabase project set up on [Supabase Cloud](https://app.supabase.com/)
2. **Supabase CLI**: Installed and authenticated (`npx supabase login`)
3. **OpenRouter API Key**: Sign up at [OpenRouter](https://openrouter.ai/) and create an API key
4. **Git Access**: Access to the repository and appropriate branch (e.g., `dev` or `main`)

## Edge Function Deployment

### Step 1: Link Your Supabase Project

If you haven't already linked your local project to your cloud project:

```bash
cd langquest
npx supabase link --project-ref your-project-ref
```

To find your project ref:
- Go to [Supabase Dashboard](https://app.supabase.com/)
- Select your project
- Navigate to **Project Settings** → **General** → **Reference ID**

### Step 2: Deploy the Edge Function

Deploy the `predict-translation` edge function:

```bash
cd langquest
npx supabase functions deploy predict-translation
```

This will:
- Bundle the function code
- Upload it to your Supabase project
- Make it available at `https://your-project.supabase.co/functions/v1/predict-translation`

### Step 3: Verify Function Configuration

Ensure the function is enabled in `supabase/config.toml`:

```toml
[functions.predict-translation]
enabled = true
verify_jwt = true
entrypoint = "./functions/predict-translation/index.ts"
```

**Note**: The `verify_jwt = true` setting ensures that only authenticated users can call the function.

## API Key Configuration

### ⚠️ Security Warning

**DO NOT commit API keys to git.** The edge function requires the `OPENROUTER_API_KEY` environment variable, which must be set as a Supabase secret.

### For Cloud/Production Deployment

#### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add new secret**
5. Set:
   - **Name**: `OPENROUTER_API_KEY`
   - **Value**: Your OpenRouter API key (starts with `sk-or-v1-...`)
6. Click **Save**

#### Option 2: Using Supabase CLI

```bash
cd langquest
npx supabase secrets set OPENROUTER_API_KEY=your_key_here --project-ref your-project-ref
```

**Important**: Replace `your_key_here` with your actual OpenRouter API key and `your-project-ref` with your project reference ID.

### For Local Development

Create a `.env` file in the `langquest/supabase/` directory:

```bash
cd langquest/supabase
echo "OPENROUTER_API_KEY=your_key_here" > .env
```

**Note**: The `.env` file in `supabase/` is gitignored and will be automatically loaded by Supabase Edge Functions when running locally.

After setting the secret, restart Supabase:

```bash
cd langquest
npm run env:stop
npm run env:start
```

## Security Considerations

### 1. API Key Storage

- ✅ **DO**: Store API keys as Supabase secrets (encrypted at rest)
- ✅ **DO**: Use environment variables for local development
- ❌ **DON'T**: Commit API keys to git
- ❌ **DON'T**: Hardcode API keys in source code
- ❌ **DON'T**: Share API keys in chat/email

### 2. Edge Function Security

The `predict-translation` function has `verify_jwt = true`, which means:
- Only authenticated users can call the function
- Requests must include a valid JWT token in the Authorization header
- The function validates the user's session before processing

### 3. Rate Limiting

Consider implementing rate limiting for the edge function to prevent abuse:
- OpenRouter API has rate limits based on your plan
- Monitor usage in Supabase Dashboard → Edge Functions → Logs
- Consider adding rate limiting middleware if needed

### 4. Cost Management

- Monitor OpenRouter API usage and costs
- Set up billing alerts in OpenRouter dashboard
- Consider implementing usage quotas per user/project

## Verification

### 1. Test Edge Function Locally

```bash
# Start local Supabase
cd langquest
npm run env:start

# Get your anon key
npx supabase status

# Test the function
curl -X POST 'http://localhost:54321/functions/v1/predict-translation' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceText": "Hello, world!",
    "sourceLanguageName": "English",
    "targetLanguageName": "Spanish",
    "examples": []
  }'
```

Replace `YOUR_ANON_KEY` with your anon key from `npx supabase status`.

### 2. Test Edge Function in Cloud

```bash
# Get your project's anon key from Supabase Dashboard
# Project Settings → API → anon/public key

curl -X POST 'https://your-project.supabase.co/functions/v1/predict-translation' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceText": "Hello, world!",
    "sourceLanguageName": "English",
    "targetLanguageName": "Spanish",
    "examples": []
  }'
```

### 3. Test in App

1. Open the app and navigate to a quest with assets
2. Create a new translation
3. Click the lightbulb icon to generate an AI prediction
4. Verify the translation appears correctly
5. Tap words to insert them into the textarea

## Troubleshooting

### Edge Function Not Found (404)

**Symptoms**: `Function not found` error when calling the function

**Solutions**:
1. Verify the function is deployed:
   ```bash
   npx supabase functions list --project-ref your-project-ref
   ```
2. Check function name matches exactly: `predict-translation`
3. Ensure function is enabled in `supabase/config.toml`

### API Key Not Configured (500)

**Symptoms**: `OpenRouter API key not configured` error

**Solutions**:
1. **For local development**:
   - Verify `langquest/supabase/.env` exists and contains `OPENROUTER_API_KEY=...`
   - Restart Supabase: `npm run env:stop && npm run env:start`

2. **For cloud deployment**:
   - Verify secret is set in Supabase Dashboard
   - Check secret name is exactly `OPENROUTER_API_KEY` (case-sensitive)
   - Redeploy function after setting secret:
     ```bash
     npx supabase functions deploy predict-translation --project-ref your-project-ref
     ```

### Unauthorized (401)

**Symptoms**: `401 Unauthorized` error

**Solutions**:
1. Verify JWT token is included in request headers
2. Check token is valid and not expired
3. Ensure `verify_jwt = true` in `supabase/config.toml` (should be true for security)

### OpenRouter API Errors

**Symptoms**: Errors from OpenRouter API (rate limits, invalid key, etc.)

**Solutions**:
1. Check OpenRouter dashboard for API key status
2. Verify API key is valid and has credits/quota
3. Check rate limits in OpenRouter dashboard
4. Review error logs in Supabase Dashboard → Edge Functions → Logs

### Function Timeout

**Symptoms**: Function times out or takes too long

**Solutions**:
1. Check OpenRouter API response times
2. Reduce number of examples (max 30 is enforced)
3. Consider using a faster model
4. Check Supabase function timeout settings

## Deployment Checklist

Before deploying to production:

- [ ] Remove any hardcoded API keys from source code
- [ ] Set `OPENROUTER_API_KEY` as Supabase secret
- [ ] Deploy edge function: `npx supabase functions deploy predict-translation`
- [ ] Verify function is accessible and returns expected responses
- [ ] Test with authenticated requests
- [ ] Monitor logs for errors
- [ ] Set up billing alerts in OpenRouter
- [ ] Document any custom model configurations
- [ ] Update app configuration if needed (API URLs, etc.)

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Local Development Setup](./SETUP.md)

## Support

If you encounter issues:
1. Check Supabase Dashboard → Edge Functions → Logs
2. Review OpenRouter dashboard for API status
3. Verify all environment variables are set correctly
4. Check function code for syntax errors: `npx supabase functions serve predict-translation --no-verify-jwt`

