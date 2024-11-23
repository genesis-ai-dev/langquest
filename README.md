# LangQuest
  
Internal mobile app for collaborative language translation.
  
## Quick Start
  
1. Install dependencies:
```bash
npm i
```
  
2. Generate database migrations (run after each edit to the `db/drizzleSchema.ts` file):
```bash
npx drizzle-kit generate
```
  
3. Run the app by following the [Expo environment setup guide](https://docs.expo.dev/get-started/set-up-your-environment/) for your platform.
  
Currently tested on:
- ✅ Android devices
- ❓ iOS (untested)

## Notes

- Database initializes and seeds (no users) automatically on first app start
- To create a user, go to the the app's registration page
- New migrations are auto-applied on app launch

## Project Structure

- `app/` - Main application screens
- `components/` - Specific modals and reusable UI components
- `database_services/` - Database services
- `db/` - Database configuration and schema
- `contexts/` - React context providers