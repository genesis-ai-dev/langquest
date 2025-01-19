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

## Building the APK

Follow these steps to build the Android APK:

1. Install EAS CLI globally:

   ```bash
   npm install -g eas-cli
   ```

2. Create an Expo account:

   - Visit https://expo.dev/signup
   - Complete the registration process

3. Log in to EAS from your terminal:

   ```bash
   eas login
   ```

4. Build the APK:
   ```bash
   eas build -p android --profile preview
   ```

Once the build completes, you can download the APK from your [EAS Dashboard](https://expo.dev).

**Note:** Each developer needs their own Expo account to build the APK. The repository includes all necessary build configurations.
