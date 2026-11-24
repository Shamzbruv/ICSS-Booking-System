const ORIGIN = 'https://icssbookings.com';
const COLOR = /^#[a-f\d]{6}$/i;
const MEDIA_PATH = /^\/media\/[a-f\d-]{36}$/i;

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const color = (value, fallback) => typeof value === 'string' && COLOR.test(value) ? value : fallback;

function publicUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return '';
    if (MEDIA_PATH.test(value)) return ORIGIN + value;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

function tenantBrand(tenant) {
    return {
        name: text(tenant.site_config?.brand?.name, 100) || text(tenant.name, 100) || 'ICSS Bookings',
        accent: color(tenant.site_config?.style?.colors?.primary, color(tenant.branding?.primaryColor, '#5946b1')),
        logo: publicUrl(tenant.site_config?.brand?.logoUrl ?? tenant.branding?.logoUrl),
        url: ORIGIN + '/' + encodeURIComponent(tenant.slug)
    };
}

function cleanDesign(input = {}) {
    return {
        layout: ['classic', 'bold', 'minimal'].includes(input.layout) ? input.layout : 'classic',
        accent: color(input.accent, ''),
        background: color(input.background, '#f4f4f8'),
        showLogo: input.showLogo !== false,
        footer: text(input.footer, 220)
    };
}

function cleanMessage(input = {}) {
    const actionLabel = text(input.actionLabel, 45).replace(/[\r\n]+/g, ' ');
    const actionUrl = publicUrl(input.actionUrl);
    if (Boolean(actionLabel) !== Boolean(actionUrl)) {
        throw Object.assign(new Error('Enter both a button label and a valid HTTPS link, or leave both blank.'), { status: 400 });
    }
    return {
        subject: text(input.subject, 140).replace(/[\r\n]+/g, ' '),
        heading: text(input.heading, 140),
        body: text(input.body, 10000),
        image: publicUrl(input.image),
        actionLabel,
        actionUrl
    };
}

function foreground(hex) {
    const channels = hex.slice(1).match(/../g).map(value => {
        const channel = parseInt(value, 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#111827' : '#ffffff';
}

function renderNewsletter({ brand, design, message, unsubscribe,
    subscriptionReason = `You subscribed to updates from ${brand.name}.`, unsubscribeLabel = 'Unsubscribe' }) {
    const accent = design.accent || brand.accent;
    const ink = foreground(accent);
    const bold = design.layout === 'bold';
    const minimal = design.layout === 'minimal';
    const header = bold ? accent : '#ffffff';
    const heading = message.heading || message.subject || 'Newsletter preview';
    const logo = design.showLogo && brand.logo
        ? `<img src="${escape(brand.logo)}" width="56" alt="" style="display:block;width:56px;max-height:56px;object-fit:contain;margin:0 0 12px">` : '';
    const hero = message.image
        ? `<img src="${escape(message.image)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;margin:0 0 22px">` : '';
    const paragraphs = message.body.split(/\r?\n\s*\r?\n/).filter(Boolean)
        .map(value => `<p style="margin:0 0 18px;overflow-wrap:anywhere">${escape(value).replace(/\r?\n/g, '<br>')}</p>`).join('');
    const button = message.actionUrl
        ? `<p style="margin:24px 0 0"><a href="${escape(message.actionUrl)}" style="display:inline-block;background:${accent};color:${ink};padding:12px 18px;border-radius:8px;font-weight:bold;text-decoration:none">${escape(message.actionLabel)}</a></p>` : '';
    const footer = unsubscribe
        ? `<p style="margin:10px 0 0">${escape(subscriptionReason)} <a href="${escape(unsubscribe)}" style="color:#344054">${escape(unsubscribeLabel)}</a></p>` : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:${design.background};font-family:Arial,sans-serif;color:#182335">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${design.background}"><tr><td align="center" style="padding:22px 10px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;overflow:hidden;border-radius:${minimal ? 0 : 12}px">
            <tr><td style="background:${header};color:${bold ? ink : '#182335'};border-top:${minimal ? 0 : 6}px solid ${accent};padding:24px 26px 16px">
              ${logo}<p style="margin:0 0 8px;font-size:14px;font-weight:bold">${escape(brand.name)}</p>
              <h1 style="margin:0;font-size:29px;line-height:1.18;overflow-wrap:anywhere">${escape(heading)}</h1>
            </td></tr>
            <tr><td style="padding:22px 26px 26px;font-size:16px;line-height:1.65">${hero}${paragraphs}${button}</td></tr>
            <tr><td style="padding:18px 26px;background:#f8f9fc;color:#475467;font-size:13px;line-height:1.5">
              <a href="${escape(brand.url)}" style="color:#344054">${escape(brand.name)}</a>${design.footer ? `<p>${escape(design.footer)}</p>` : ''}${footer}
            </td></tr>
          </table>
        </td></tr></table>
      </body></html>`;
    const plain = [brand.name, heading, message.body, message.actionUrl && `${message.actionLabel}: ${message.actionUrl}`,
        design.footer, brand.url, unsubscribe && `${unsubscribeLabel}: ${unsubscribe}`].filter(Boolean).join('\n\n');
    return { html, text: plain };
}

module.exports = { ORIGIN, escape, text, publicUrl, tenantBrand, cleanDesign, cleanMessage, renderNewsletter };
