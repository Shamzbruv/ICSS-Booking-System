# WhatsApp notifications

Open `/platform`, sign in, and select **WhatsApp**.

1. The platform owner enters the Twilio Account SID, Auth Token and online WhatsApp number (`+16676604341`). Save with automatic notifications disabled first. Blank Auth Token preserves the saved token. Secrets use the existing server `ENCRYPTION_KEY` (AES-256-GCM); never rotate that key without migrating encrypted data.
2. Test the saved connection. This reads Twilio account status without sending a message. The optional test-message panel sends a labelled test to a consenting number and may incur charges.
3. Confirm the nine preloaded HX template IDs match the approved templates. The cancelled client template uses v2. Confirmation variable 6 is the booking reference, not a calendar URL. If template bodies change, review the variable mappings in `server/services/whatsapp.js` too.
4. Saving with automatic notifications enabled finds the registered sender and configures Twilio reply and delivery webhooks automatically. WhatsApp uses the public HTTPS `PUBLIC_APP_URL` or `BASE_URL` when valid, otherwise the canonical `https://icssbookings.com` origin. No URL setup is required in the console. The saved callback URL is reused for signature validation. If Twilio rejects credentials or the sender is offline, the save reports the problem without claiming setup succeeded.
5. Every existing and future business receives enabled defaults automatically (24- and 2-hour reminders, daily limit 100). Select a business only to configure consenting service-provider recipients or override its settings. Individual opt-outs survive restarts. Default reminder times are 24 and 2 hours; default daily limit is 100 attempted messages per business. Provider alerts are business-wide; this booking schema does not have assigned staff. Do not configure unauthorized recipients. Customer notifications require the existing booking WhatsApp opt-in checkbox.
6. Keep the global automatic-notification switch enabled when ready. There is no per-business activation step required; individual businesses can still be disabled. Existing bookings are not replayed as new events; future reminders for confirmed upcoming appointments can send. Test with a consenting controlled customer/provider before enabling real tenants.

## Behaviour

PostgreSQL triggers capture new bookings, confirmation, applied date/time changes and cancellation/rejection in the booking transaction. A durable outbox plans separate client/provider deliveries. Pending bookings get request acknowledgment; confirmation transitions get confirmation. The worker starts with the server and runs every minute. Reminders run within a two-minute due window. Long server outages can miss reminder windows rather than sending late alerts.

Only opted-in recipients in enabled businesses send. STOP replies persist a phone-wide suppression across future bookings. Other replies are not a supported inbox: messages instruct customers to contact the booked business directly. No automatic START re-subscription is provided yet.

Delivery history shows the latest 100 messages, queued/sent/delivered/read/failed/skipped/unknown states. Signature-verified callbacks update statuses. Accepted API requests are not labelled delivered. Explicit 429 rate limits retry at two-minute intervals, at most three attempts. Network failures or interrupted sends become unknown and require manual reconciliation in Twilio logs, avoiding unsafe duplicate sends. There is no bulk replay button.

## Rollout checks

- Verify live delivery to a controlled customer and provider; no live credentials were available during implementation.
- Test a pending booking, approval, reschedule and cancellation; confirm obsolete reminders do not send.
- Check local date/time and sender display name on a real phone.
- Confirm Twilio/Meta approves the intended platform messaging model before enabling tenant-wide production traffic. Each tenant's own WhatsApp sender requires Tech Provider onboarding; this release uses the ICSS sender.

Code deploys from GitHub. No credentials are committed. Existing environment credential values can prefill server-side configuration, but this new integration remains disabled until enabled in the platform. The additive schema initializes on normal startup.
