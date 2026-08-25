# Plan for Finishing V1 in Mobile App

## Context
The mobile application currently has a placeholder for event creation screen (`/apps/mobile/app/(protected)/sessions/nouvelle.tsx`) that displays a "Coming Soon" message and redirects users to the web version. To complete V1 as defined in CCH.md, this screen must be implemented natively in the mobile app. Other V1 features (accounts, profiles, groups, events listing/detail, notifications, sharing, anti-spam, player discovery minimal profiles, blocking, back-office dashboard/moderation/audit) appear to be present or partially implemented, but require verification.

## Recommended Approach
1. **Implement Event Creation Screen**: Port the frontend's `CreateEvent.tsx` (`/frontend/src/pages/CreateEvent.tsx`) to mobile, adapting to React Native/Expo and the mobile app's UI components (`five-api-client`, `five-ui`, `expo-router`).
2. **Verify V1 Feature Completeness**: Audit key mobile screens against CCH.md V1 requirements to identify and document any remaining gaps.
3. **Focus on Critical User Paths**: Ensure the four critical user paths (create event, reserve/pay [though payment is V1.5], generate teams [V1.5], join group) work end-to-end in mobile, with special attention to event creation and group joining.

## Implementation Details for Event Creation Screen

### File to Create/Modify
- `/apps/mobile/app/(protected)/sessions/nouvelle.tsx` (replace current ComingSoon placeholder)

### Key Adaptations from Web to Mobile
- **Routing**: Use `expo-router`'s `useLocalSearchParams` for `groupId` and `Link` for navigation.
- **API Client**: Use `five-api-client` (same as web) with `api.post('/events', payload)`.
- **UI Components**: Replace web `input`/`select` with `react-native` equivalents styled via `tailwindcss` (via `nativewind`) and `five-ui` components (`Field`, `Input`, `Button`).
- **Form State**: Use `React.useState` for form fields and validation.
- **Loading/Error States**: Use `five-ui` `Loading` and `Alert` components.
- **DateTime Input**: Use `react-native-datetime-picker` or similar if not already available; otherwise use `Input` with platform-specific handling.
- **Dropdowns**: Use `react-native-picker-select` or custom modal with `FlatList` for groups/venues if `select` not ideal; otherwise use `Input` with `Picker` (if available in `five-ui`).

### Components to Reuse
- `Screen` from `../../components/Screen`
- `PageTitle`, `Field`, `Input`, `Button`, `Alert`, `Loading` from `five-ui`
- `Link` from `expo-router`
- `api`, `useCurrentUser` from `five-api-client`

### Data Fetching
- On `useEffect`: Fetch `/groups` (filter to `isMember`) and `/venues` to populate dropdowns.
- Transform API response to `{ id, name }` for dropdown options.

### Form Fields (matching web)
- `title` (text, required)
- `dateTime` (datetime-local, required) → adapt to mobile date/time picker
- `location` (text, optional)
- `capacity` (number, required, min=1, max=50)
- `price` (number, optional, min=0, step=0.5)
- `description` (text, optional)
- `venueId` (dropdown, optional, from venues fetch)
- `groupId` (dropdown, optional, from groups fetch, pre-filled from searchParams if present)

### Submission Flow
1. Set loading state, clear errors.
2. Build payload:
   - Convert `dateTime` to ISO string (mobile date/time picker may already return ISO or need conversion).
   - Convert `capacity` and `price` to numbers.
   - Only include optional fields if value is not empty.
3. Call `api.post('/events', payload)`.
4. On success: Navigate to event detail screen using `Link` or `router.replace` with `/sessions/${event.id}`.
5. On error: Set error from response data.
6. Finally: Set loading to false.

### UI/UX Considerations
- Use `ScrollView` or `KeyboardAvoidingView` to handle keyboard.
- Validate required fields before submission.
- Show success notice upon creation (could use `Alert` or temporary toast).
- Follow existing mobile app styling patterns (spacing, colors, typography).

## Verification of Other V1 Features in Mobile
After event creation implementation, verify the following mobile screens/components against CCH.md V1 requirements:

### Accounts & Profiles (C-)
- [ ] Registration (`register.tsx`) - verified
- [ ] Login (`login.tsx`) - verified
- [ ] Profile view/edit (`profil/index.tsx`, `profil/donnees.tsx`) - check visibility controls (C-04)
- [ ] Email verification flow (check if exists in profile)
- [ ] Data export/deletion (C-06) - may require backend, check UI triggers

### Groups (G-)
- [ ] Group creation (`groupes/nouveau.tsx`)
- [ ] Group invitation flow (check if shareable link/invite token handling exists)
- [ ] Group member list (`groupes/[groupId].tsx`)
- [ ] Join/leave group (check group detail API)
- [ ] Private/public group indicators (check group creation/settings)

### Events (E-)
- [ ] Event listing (check if dashboard or home shows events list - currently shows in dashboard via `/events` API)
- [ ] Event detail (`sessions/[eventId].tsx`) - verified
- [ ] Event creation (to be implemented)
- [ ] Joining/waitlist (verified in event detail)
- [ ] Shareable link (check if event detail has share button and token generation)
- [ ] Event statuses (draft, open, completed, cancelled) - verify in UI
- [ ] Reminder/non-response (N-03) - verified in event detail

### Notifications (N-)
- [ ] Notifications list (`notifications/index.tsx`)
- [ ] Notification preferences (`notifications/preferences.tsx`)
- [ ] Push event notifications (verify if implemented, may require native setup)
- [ ] Transactional emails (V1.5, skip for V1)
- [ ] Non-response reminders (verified in events)

### Social (S-)
- [ ] Anti-spam (rate limiting on remind - verified)
- [ ] External sharing to WhatsApp (check if share button uses `Share` API or `Linking` for `wa.me`)
- [ ] Other social features (group feed, chat, etc.) are V1.5+/V2

### Player Discovery (D-)
- [ ] Public minimal profile (check if profile accessible without login shows only permitted fields)
- [ ] Blocking (`profil/blocages.tsx`) - verified
- [ ] Open sessions search (V1.5, skip)
- [ ] Join request validation (V1.5, skip)
- [ ] Local recommendations, reputation (V2, skip)

### Back-office (B-)
- [ ] Dashboard (`admin/index.tsx`) - verified
- [ ] Moderation (check admin screens for reports, blocking, content removal)
- [ ] Support (check if admin has user search/resolution)
- [ ] Assisted refunds (V1.5, skip)
- [ ] Audit log (B-06) - check if admin has audit log view
- [ ] Parameterization (V2, skip)

### Partners (PA-)
- [ ] All V1.5+/V2, skip for V1

## Testing & Verification
- **Manual Testing**: Implement event creation and test end-to-end flow:
  1. Create event with required fields.
  2. Verify event appears in dashboard/events list.
  3. Verify event detail shows correct info.
  4. Verify joining/waitlist works.
  5. Verify sharing generates functional link.
- **API Testing**: Ensure all required endpoints exist and return correct data.
- **Comparison**: Compare mobile event creation functionality with web version for parity.
- **User Flow Testing**: Test critical paths:
  - Create an event → share link → another user joins via link.
  - Join a group → see upcoming events → create event within group.

## Dependencies
- Verify `five-ui` has necessary components (date/time picker, dropdown/select) or install/compatible alternatives.
- Ensure `expo-router` and `five-api-client` are properly configured.
- Check if `react-native-datetime-picker` or similar is needed; if so, add to `package.json`.

## Estimated Effort
- Implementation: 8-12 hours (including adaptation, testing, and verification of related features).
- Verification of other V1 features: 4-6 hours.

## Notes
- Payment processing (P-) and FiveComposer (FC-) are explicitly V1.5 per CCH.md and should not be included in V1.
- Focus on solidifying the core V1 experience before advancing to monetization and differentiation features.
- The event creation screen is a key blocker for V1 completion; implementing it will unlock the full create→fill→share critical path.