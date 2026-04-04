# PR #818 — Tier 1 Testing (Directly Changed)

## Navigation & Routing

- [ ] All screens reachable — projects, project detail, quest, asset, recording
- [ ] Back navigation works at every level of nesting
- [ ] Breadcrumbs show correct hierarchy
- [x] Hardware back button works on Android (drawer closes first, then navigates back)
- [x] Not-found page shows for invalid routes

## Deep Links

- [ ] Reset password — App (Android)
- [x] Reset password — App (iOS)
- [x] Reset password — Website
- [x] Registration confirmation email link works (Website)
- [x] Registration confirmation email link works (Android)
- [x] Registration confirmation email link works (iOS)
- [ ] Accept invite from email (Android)
- [ ] Accept invite from email (iOS)

## Auth Flow

- [ ] Register in another language
- [x] Forgot password — sends email, navigates back to sign-in with email preserved
- [x] Sign-in → Register → Sign-in email param passing works
- [x] Authenticated users redirected away from sign-in/register pages
- [x] Terms page shows for new users, doesn't re-show after acceptance
