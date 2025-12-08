# Security Review Checklist

When reviewing code, check for:

- [ ] Raw user input in sensitive operations
- [ ] Secrets in code or configuration files
- [ ] Insecure protocols (HTTP instead of HTTPS)
- [ ] Dynamic code execution with user input
- [ ] Missing input validation
- [ ] Sensitive data in logs
- [ ] Disabled or bypassed security checks
- [ ] Client-side-only security logic
- [ ] Hardcoded credentials
- [ ] SQL injection vulnerabilities (especially raw SQL strings with user input instead of Drizzle query builder)
- [ ] Path traversal risks
- [ ] Command injection risks
- [ ] XSS vulnerabilities
- [ ] SSRF vulnerabilities

## Project-Specific Checks

### Database & PowerSync
- [ ] Using Drizzle ORM query builder (`system.db.query.*`) instead of raw SQL
- [ ] PowerSync watch queries use `db.watch(<drizzleQuery>)` pattern
- [ ] No string interpolation in `db.execute()` calls
- [ ] All user input validated before database operations
- [ ] Row Level Security (RLS) policies in place for Supabase tables
- [ ] PowerSync Sync Rules properly scoped (review `supabase/config/sync-rules.yml`)
- [ ] Sync Rules use `request.user_id()` or validated parameters, not user-controlled input
- [ ] Data validated before PowerSync uploads to backend

### React Native/Expo
- [ ] No secrets stored in client-side code (React Native/Expo)
<!-- - [ ] Secure storage used for sensitive data (`expo-secure-store`) -->
<!-- - [ ] No sensitive data in `AsyncStorage` or plain text -->
- [ ] Environment variables used for non-sensitive config (`EXPO_PUBLIC_` prefix)

### File & Network Operations
- [ ] File paths validated and restricted to allowed directories
- [ ] URLs validated before making network requests (only allow https://)
- [ ] API keys not exposed in frontend code
- [ ] PowerSync connection URLs use environment variables

