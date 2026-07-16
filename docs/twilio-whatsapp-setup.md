# Twilio WhatsApp booking confirmations

The Twilio Sandbox is only for testing with numbers that manually join the sandbox. Production booking confirmations require a registered WhatsApp sender and an approved Utility content template.

## 1. Register the sender

In Twilio Console, open **Messaging → Senders → WhatsApp Senders** and register the business WhatsApp number. Complete Meta Business verification when prompted.

## 2. Create the confirmation template

In **Messaging → Content Template Builder**, create a WhatsApp template in the **Utility** category with these variables in this exact order:

```text
Hi {{1}}, your booking with {{2}} is confirmed.

Service: {{3}}
Date: {{4}}
Time: {{5}}

Add it to your calendar: {{6}}
```

Variables supplied by ICSS:

1. Client first name
2. Tenant/business name
3. Service name
4. Confirmed date
5. Confirmed time
6. Secure calendar page (Google, Apple, Outlook, and `.ics`)

Submit the template for WhatsApp approval and copy its `HX...` Content SID after approval.

## 3. Configure Railway

Add these variables to the production service. Never paste the Auth Token into source code or a support message.

```text
WHATSAPP_ENABLED=false
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+1876...
TWILIO_WHATSAPP_CONTENT_SID=HX...
CALENDAR_LINK_SECRET=<long random secret>
```

Deploy once with `WHATSAPP_ENABLED=false`, confirm the other values are present, then change it to `true`.

## 4. Test

Create a real test booking, tick the WhatsApp consent option, and confirm it. The customer should receive the usual email plus the WhatsApp template. The calendar link opens a private page with Google Calendar and universal `.ics` options.

Each booking records whether WhatsApp was requested, accepted by Twilio, skipped, or failed. A failed WhatsApp request does not prevent the email confirmation from being sent.
