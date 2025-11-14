# Deployment Checklist - AI Translation Feature

## Pre-Deployment

- [ ] Test locally with `npm run env:start`
- [ ] Verify AI prediction works in app
- [ ] Run linter: `npm run lint`
- [ ] Run type check: `npm run typecheck`
- [ ] Test on both iOS and Android (if applicable)
- [ ] Review git changes: `git status` and `git diff`

## Backend Deployment (Supabase Edge Functions)

### Development Environment

```bash
# Link to dev project
npx supabase link --project-ref yjgdgsycxmlvaiuynlbv

# Set API key secret
npx supabase secrets set OPENROUTER_API_KEY=your_key_here --project-ref yjgdgsycxmlvaiuynlbv

# Deploy edge function
npx supabase functions deploy predict-translation --project-ref yjgdgsycxmlvaiuynlbv

# Test the deployment
curl -X POST 'https://yjgdgsycxmlvaiuynlbv.supabase.co/functions/v1/predict-translation' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"sourceText": "Hello", "sourceLanguageName": "English", "targetLanguageName": "Spanish", "examples": []}'
```

### Production Environment

```bash
# Link to prod project
npx supabase link --project-ref unsxkmlcyxgtgmtzfonb

# Set API key secret
npx supabase secrets set OPENROUTER_API_KEY=your_key_here --project-ref unsxkmlcyxgtgmtzfonb

# Deploy edge function
npx supabase functions deploy predict-translation --project-ref unsxkmlcyxgtgmtzfonb

# Test the deployment
curl -X POST 'https://unsxkmlcyxgtgmtzfonb.supabase.co/functions/v1/predict-translation' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"sourceText": "Hello", "sourceLanguageName": "English", "targetLanguageName": "Spanish", "examples": []}'
```

## Frontend Deployment (Expo App)

### For JavaScript-Only Changes (Current Changes)

Use EAS Update for instant deployment:

```bash
# Development channel
eas update --branch development --message "AI translation: lightbulb UI, word tapping, improved example selection"

# Production channel
eas update --branch production --message "AI translation: lightbulb UI, word tapping, improved example selection"
```

**Notes:**
- Updates are automatically downloaded on app launch
- No app store review required
- Users see changes within minutes to hours

### For Native Code Changes (Not needed now)

If you had native changes:

```bash
# Build for app stores
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Post-Deployment Verification

### Backend

- [ ] Check Supabase Dashboard → Edge Functions → Logs for errors
- [ ] Verify `OPENROUTER_API_KEY` is set in Edge Function secrets
- [ ] Test AI prediction from app with cloud backend

### Frontend

- [ ] Open app and verify update is applied
- [ ] Test AI translation feature end-to-end:
  - [ ] Lightbulb icon appears
  - [ ] AI prediction generates successfully
  - [ ] Word tapping inserts words into textarea
  - [ ] Eye icon shows prediction details
  - [ ] Reload button refreshes prediction
  - [ ] No more than 30 examples are used
  - [ ] Highest-rated translations are prioritized
- [ ] Check for any console errors or warnings

### Monitoring

- [ ] Monitor OpenRouter API usage/costs
- [ ] Check Supabase Edge Function usage
- [ ] Monitor app crash rates (if you have analytics)
- [ ] Gather user feedback

## Rollback Plan

### Backend

```bash
# Redeploy previous version
git checkout <previous-commit>
npx supabase functions deploy predict-translation --project-ref <project-ref>
git checkout main
```

### Frontend

```bash
# Publish a rollback update
eas update --branch <channel> --message "Rollback AI translation changes"
```

## Environment Configuration

### Development

- Supabase Project: `yjgdgsycxmlvaiuynlbv`
- App Variant: `development`
- Bundle ID: `com.etengenesis.langquest.dev`

### Production

- Supabase Project: `unsxkmlcyxgtgmtzfonb`
- App Variant: `production`
- Bundle ID: `com.etengenesis.langquest`

## Additional Notes

- The AI translation feature uses the `predict-translation` Edge Function
- Examples are capped at 30 and prioritize:
  1. Current quest translations (highest-rated)
  2. Other quests in same project (highest-rated)
- OpenRouter API key must be configured as a Supabase secret
- Word tapping feature requires no additional backend changes
- UI changes (lightbulb icon, eye icon, word tapping) are frontend-only

## Support

If issues arise:
1. Check Supabase Dashboard → Edge Functions → Logs
2. Check OpenRouter dashboard for API errors
3. Review app logs for frontend errors
4. Verify environment variables are set correctly

