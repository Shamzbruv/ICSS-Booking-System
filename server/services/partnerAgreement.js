const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const PizZip = require('pizzip');

const TEMPLATE_PATH = path.join(__dirname, '../../ICSS_Booking_Marketing_Revenue_Share_Agreement.docx');
const decodeXml = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function sourceAgreementParagraphs() {
    const xml = new PizZip(fs.readFileSync(TEMPLATE_PATH)).file('word/document.xml').asText();
    return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(match => decodeXml(
        [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(run => run[1]).join('')
    ).trim()).filter(Boolean);
}

const REVISED_CLAUSES = new Map([
    ['1.2 The Partner will provide marketing, social-media management, audience engagement, campaign support, and tenant-referral services. The Owner will retain responsibility for Platform technology, security, billing, product decisions, and technical operations.',
        '1.2 The Partner will provide marketing, social-media management, audience engagement, campaign support, and subscription-growth services. The Owner will retain responsibility for Platform technology, security, billing, product decisions, and technical operations.'],
    ['1.3 The purpose of this Agreement is to define the Partner’s appointment, the rules for attributing Referred Tenants, the 50% revenue share, ownership and access controls, and the Parties’ rights when the relationship ends.',
        '1.3 The purpose of this Agreement is to define the Partner’s appointment, the platform-wide 50% revenue share on all new paid subscriptions from the Effective Date, ownership and access controls, and the Parties’ rights when the relationship ends.'],
    ['2.1 Appointment. The Owner appoints the Partner, and the Partner accepts appointment, as a non-exclusive independent marketing and referral contractor for the Platform during the Term.',
        '2.1 Appointment. The Owner appoints the Partner, and the Partner accepts appointment, as a non-exclusive independent marketing contractor for the Platform during the Term.'],
    ['2.4 Non-exclusivity. The Owner may market the Platform directly and may appoint other marketers, agents, resellers, or referral partners. A Tenant properly attributed to the Partner under section 7 remains the Partner’s Referred Tenant, subject to this Agreement.',
        '2.4 Non-exclusivity. The Owner may market the Platform directly and may appoint other marketers, agents, or resellers. The Partner’s compensation is platform-wide as stated in sections 7 and 8 and does not depend on who sourced, introduced, or converted a Tenant.'],
    ['recurring subscription-plan fees actually received and cleared by the Owner from a Referred Tenant for access to the Platform',
        'recurring subscription-plan fees actually received and cleared by the Owner from a Tenant whose paid subscription began on or after the Effective Date'],
    ['Gross Subscription Revenue less: refunds, credits, chargebacks, payment-processing fees, sales or consumption taxes, withholding taxes, fraud losses, currency-conversion costs charged by a processor or bank, and amounts the Owner is required to return or remit to another person',
        'Gross Subscription Revenue less only refunds, credits, chargebacks, payment-processing fees, fraud losses, currency-conversion costs charged by a processor or bank, and amounts the Owner is required to return to another person. Taxes are the Owner’s responsibility and are not deducted from the Partner’s share except where deduction is strictly required by applicable law.'],
    ['Referred Tenant', 'Covered Tenant'],
    ['a Tenant attributed to the Partner through the process and conditions in section 7',
        'a Tenant whose first paid Platform subscription begins on or after the Effective Date and is therefore automatically covered by sections 7 and 8'],
    ['5.1 Marketing services. The Partner shall use commercially reasonable efforts to build awareness of the Platform, generate qualified leads, and manage the Social Platforms in accordance with the cadence, channels, and approval contacts in Schedule 1.',
        '5.1 Marketing services. The Partner shall use commercially reasonable efforts to build awareness of the Platform, generate qualified leads, and manage the Social Platforms through the approved channels and contacts in Schedule 1. The Partner has no fixed schedule, minimum shift, or prescribed working hours and may choose the days, times, and shifts worked, provided agreed deliverables and deadlines are met.'],
    ['5.3 Lead generation. The Partner shall actively identify prospective Tenants, accurately explain the Platform at a high level, use the agreed tracking process, and provide sufficient lead details for attribution and follow-up.',
        '5.3 Lead generation. The Partner shall actively identify prospective Tenants, accurately explain the Platform at a high level, and provide reasonable lead details for follow-up. Compensation is governed solely by the automatic platform-wide revenue share in sections 7 and 8.'],
    ['5.7 Reporting and records. By the fifth Business Day of each month, the Partner shall provide a concise report covering content published, campaign results, audience activity, leads submitted, active opportunities, approved spend, and any issue requiring the Owner’s decision.',
        '5.7 Reporting and records. Once every two weeks, on Friday, the Partner shall provide the Owner with one concise analysis covering content published, campaign results, audience activity, leads, active opportunities, approved spend, and any issue requiring the Owner’s decision. No additional routine report or fixed work schedule is required unless the Parties agree otherwise in writing.'],
    ['6.3 Marketing enablement. The Owner shall provide reasonable access to approved brand assets, accurate product information, campaign approvals, and the referral-tracking method needed for the Partner to perform the services.',
        '6.3 Marketing enablement. The Owner shall provide reasonable access to approved brand assets, accurate product information, campaign approvals, and the systems reasonably needed for the Partner to perform the services.'],
    ['6.4 Statements and payments. The Owner shall maintain reasonable records of accepted referrals and amounts payable, issue monthly statements, and pay valid revenue-share amounts in accordance with section 8.',
        '6.4 Statements and payments. The Owner shall maintain reasonable records of new paid Platform subscriptions and amounts payable, provide the Partner with an understandable payment record, and pay valid revenue-share amounts in accordance with section 8.'],
    ['7. Referral Attribution', '7. Platform-Wide Subscription Revenue Share'],
    ['7.1 Lead registration. Before or promptly after the first substantive introduction, the Partner must submit the prospective Tenant through the agreed referral link, referral code, CRM record, email, or other written method specified in Schedule 1. The submission must identify the prospect, a reliable contact method, the date, the source, and the Partner’s involvement.',
        '7.1 Automatic coverage. Every Tenant who first enters a paid Platform subscription on or after the Effective Date is automatically covered by the Parties’ 50% revenue-share arrangement, regardless of who sourced, introduced, marketed to, contacted, or converted that Tenant.'],
    ['7.2 Acceptance or rejection. Within five Business Days after receiving sufficient information, the Owner shall confirm whether the lead is accepted. The Owner may reasonably reject a lead that is already a Tenant; was in the Owner’s documented active sales pipeline during the preceding ninety days; was first registered by another source; lacks reliable identifying information; is a self-referral or related-party referral not approved in writing; or presents legal, fraud, credit, reputational, or operational risk.',
        '7.2 Automatic entitlement. The Partner’s entitlement does not depend on who generated or converted the subscription or on any individual source record. The Owner shall not deny the share because a subscription came through the Owner, another marketer, an advertisement, an organic source, or any other channel.'],
    ['7.3 Conversion window. An accepted lead becomes a Referred Tenant if it enters a paid Platform subscription within 180 days after acceptance. The Owner may extend that period in writing. If the period expires, the Partner may re-register the lead if it is not then active in another documented sales channel.',
        '7.3 Start and duration. Coverage begins when the new Tenant’s first subscription payment is actually received and cleared and continues for each cleared recurring subscription payment while that Tenant remains an Active Paying Tenant, subject to this Agreement.'],
    ['7.4 Duplicate claims. The first complete referral record accepted by the Owner controls. The Owner shall decide duplicate or disputed claims reasonably and in good faith using timestamps, communications, CRM records, and evidence of the material introduction.',
        '7.4 Existing Tenants. A Tenant whose paid subscription began before the Effective Date is excluded unless the Parties expressly add that Tenant in a signed written amendment.'],
    ['7.5 Reactivation. If a Referred Tenant cancels and resumes a paid subscription within twelve months, the resumed subscription remains attributed to the Partner. A reactivation after twelve months is treated as a new sale unless the Owner agrees otherwise in writing.',
        '7.5 Reactivation. If a covered Tenant cancels and later begins paying again, the reactivated paid subscription remains covered by this platform-wide revenue share.'],
    ['7.6 No circumvention. The Owner shall not deliberately reclassify or route an accepted referral for the primary purpose of avoiding the Partner’s revenue share. The Partner shall not split, duplicate, fabricate, purchase, or manipulate referrals or cause a Tenant to transact through another identity to obtain additional compensation.',
        '7.6 No circumvention or duplication. The Owner shall not reclassify or route a new paid subscription for the purpose of avoiding the Partner’s share. The Partner receives one 50% share of qualifying Net Subscription Revenue and may not claim a duplicate share for the same subscription payment.'],
    ['8.1 Revenue share. For each Referred Tenant, the Partner is entitled to 50% of Net Subscription Revenue for each period in which that Referred Tenant remains an Active Paying Tenant, subject to this Agreement.',
        '8.1 Revenue share. The Partner is entitled to 50% of Net Subscription Revenue from every Tenant whose paid Platform subscription begins on or after the Effective Date for each period in which that Tenant remains an Active Paying Tenant, subject to this Agreement.'],
    ['8.3 Payment schedule. The Owner shall calculate the amount monthly and pay it within fifteen Business Days after month-end, together with a statement showing each Referred Tenant by agreed identifier, Gross Subscription Revenue received, permitted deductions, Net Subscription Revenue, and the Partner’s share.',
        '8.3 Payment schedule. The Owner may either (a) pay the Partner’s share promptly after each qualifying subscription payment is received and cleared, or (b) calculate and pay the amount on a consolidated monthly basis within fifteen Business Days after month-end. With either method, the Owner shall provide a record showing the Tenant, Gross Subscription Revenue received, permitted deductions, Net Subscription Revenue, and the Partner’s 50% share. The Owner may change between these methods without reducing or delaying an amount already due.'],
    ['8.6 Taxes and withholding. Each Party is responsible for its own income, business, payroll, and other taxes. The Owner may deduct or withhold any tax required by law and shall provide reasonable evidence of the deduction or remittance. The Partner shall provide any taxpayer or payment information reasonably required for lawful reporting and payment.',
        '8.6 Taxes and withholding. As between the Parties, the Owner is responsible for calculating, reporting, withholding, remitting, and paying taxes arising from Platform subscription revenue and the revenue-share compensation paid under this Agreement. The Partner’s 50% share shall not be reduced for such taxes except where a deduction is strictly required by applicable law; if a mandatory deduction applies, the Owner shall provide reasonable evidence and remain responsible for the related filing and remittance.'],
    ['8.8 Limited audit right. Once in any twelve-month period, the Partner may, on at least fourteen days’ written notice, have an independent accountant inspect records reasonably necessary to verify payments for Referred Tenants. The inspection must occur during normal business hours, protect all third-party information, and not access source code, credentials, unrelated Tenant records, or security-sensitive material. The Partner bears the cost unless the inspection confirms an underpayment exceeding 5% for the audited period, in which case the Owner shall correct the underpayment and reimburse reasonable audit fees.',
        '8.8 Limited audit right. Once in any twelve-month period, the Partner may, on at least fourteen days’ written notice, have an independent accountant inspect records reasonably necessary to verify payments for Covered Tenants. The inspection must occur during normal business hours, protect all third-party information, and not access source code, credentials, unrelated Tenant records, or security-sensitive material. The Partner bears the cost unless the inspection confirms an underpayment exceeding 5% for the audited period, in which case the Owner shall correct the underpayment and reimburse reasonable audit fees.'],
    ['16.4 Abandonment. “Abandonment” occurs when the Partner performs no meaningful marketing, referral, reporting, or account-management activity for thirty consecutive calendar days and then fails to respond or resume performance within five Business Days after written notice from the Owner. Abandonment is a material breach permitting termination for cause.',
        '16.4 Abandonment. “Abandonment” occurs when the Partner performs no meaningful marketing, reporting, or account-management activity for thirty consecutive calendar days and then fails to respond or resume performance within five Business Days after written notice from the Owner. Choosing the Partner’s own days, hours, or shifts is not abandonment. Abandonment is a material breach permitting termination for cause.'],
    ['(a) On termination, the Partner shall stop representing itself as associated with the Platform, stop using Owner marks, complete the handover required by section 10.4, return or delete protected information, and submit a final activity and referral report within five Business Days.',
        '(a) On termination, the Partner shall stop representing itself as associated with the Platform, stop using Owner marks, complete the handover required by section 10.4, return or delete protected information, and submit a final activity report within five Business Days.'],
    ['(c) If this Agreement ends without cause, or is terminated by the Partner because of the Owner’s uncured material breach, the Partner’s 50% revenue share continues for each existing Referred Tenant for as long as that Tenant remains an Active Paying Tenant. No revenue share is earned from a new Tenant that subscribes after termination unless the lead was accepted before termination and converts within the original 180-day window.',
        '(c) If this Agreement ends without cause, or is terminated by the Partner because of the Owner’s uncured material breach, the Partner’s 50% revenue share continues for each covered Tenant whose paid subscription began before termination for as long as that Tenant remains an Active Paying Tenant. No revenue share is earned from a Tenant whose first paid subscription begins after termination.'],
    ['(e) If an attribution or payment was obtained through fraud, fabrication, or deliberate manipulation, it is void and the Owner may recover the resulting overpayment.',
        '(e) If a payment was obtained through fraud, fabrication, duplication, or deliberate manipulation, it is void and the Owner may recover the resulting overpayment.'],
    ['19.3 Assignment. The Partner may not assign, subcontract, delegate, or transfer this Agreement or any residual right without the Owner’s prior written consent. The Owner may assign this Agreement to an affiliate or to a purchaser or successor of the Platform or substantially all related business assets, provided the assignee assumes the Owner’s continuing payment obligations.',
        '19.3 Assignment. The Partner may not assign, subcontract, delegate, or transfer this Agreement or any residual right without the Owner’s prior written consent. The Owner may assign this Agreement to an affiliate or to a purchaser or successor of the Platform or substantially all related business assets, provided the assignee assumes the Owner’s continuing payment obligations.'],
    ['19.8 Further assurance. Each Party shall sign and do reasonable things necessary to give effect to this Agreement, including confirming account control, intellectual-property ownership, referral attribution, and lawful payment reporting.',
        '19.8 Further assurance. Each Party shall sign and do reasonable things necessary to give effect to this Agreement, including confirming account control, intellectual-property ownership, platform-wide subscription records, and lawful payment reporting.'],
    ['Referral method', 'Subscription attribution method'],
    ['50% of Net Subscription Revenue from Referred Tenants', '50% of Net Subscription Revenue from every new paid Platform subscription from the Effective Date'],
    ['Statement frequency', 'Payment record frequency'],
    ['Monthly', 'With each payment or with the consolidated monthly payment'],
    ['Within 15 Business Days after month-end', 'Promptly after each cleared subscription payment, or within 15 Business Days after month-end'],
    ['Minimum content cadence', 'Work schedule'],
    ['Approved monthly ad budget', 'Analysis frequency'],
    ['Accepted referrals at Effective Date', 'Existing paid subscriptions included at Effective Date'],
]);

function agreementParagraphs() {
    const revised = [];
    for (const paragraph of sourceAgreementParagraphs()) {
        const previous = revised.at(-1);
        if (paragraph === 'N/A' && previous === 'Subscription attribution method') revised.push('Automatic — all new paid Platform subscriptions from the Effective Date');
        else if (paragraph === 'N/A' && previous === 'Analysis frequency') revised.push('Once every two weeks, delivered on Friday');
        else if (paragraph === 'N/A' && previous === 'Existing paid subscriptions included at Effective Date') revised.push('None');
        else if (paragraph === 'Partner will communicate in writing' && previous === 'Work schedule') revised.push('No fixed schedule; Partner chooses days, hours and shifts');
        else revised.push(REVISED_CLAUSES.get(paragraph) || paragraph);
    }
    return revised;
}

function fill(text, a) {
    const date = a.effective_date ? String(a.effective_date).slice(0, 10) : '[OWNER TO SET]';
    return text.replaceAll("[INSERT PARTNER'S FULL LEGAL NAME]", a.partner_name || '[PARTNER NAME]')
        .replaceAll('[INSERT FULL LEGAL NAME]', a.partner_name || '[PARTNER NAME]')
        .replaceAll('[INSERT FULL ADDRESS]', a.partner_address || '[PARTNER ADDRESS]')
        .replaceAll('[INSERT EMAIL]', a.partner_email)
        .replaceAll('[INSTAGRAM / FACEBOOK / TIKTOK / LINKEDIN / X / YOUTUBE / OTHER]', a.approved_social_platforms || 'None specified')
        .replaceAll('[INSERT DATE]', date);
}

function generateAgreementPdf(a) {
    return new Promise((resolve, reject) => {
        const purple = '#6D5CE7', ink = '#202033', muted = '#66667A', pale = '#F4F2FF', yellow = '#FFF4B8';
        const doc = new PDFDocument({ size: 'LETTER', margins: { top: 66, bottom: 60, left: 58, right: 58 }, bufferPages: true, info: { Title:'ICSS Marketing Services and Revenue Share Agreement', Author:'I Create Solutions & Services' } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        doc.rect(0, 0, 612, 792).fill('#11111D');
        const logo = path.join(__dirname, '../../public/logo.png');
        if (fs.existsSync(logo)) { try { doc.image(logo, 58, 58, { fit:[70,70] }); } catch {} }
        doc.fillColor('#9E94FF').font('Helvetica-Bold').fontSize(11).text('ICSS BOOKING SYSTEM', 58, 150, { characterSpacing:1.8 });
        doc.fillColor('#FFFFFF').fontSize(28).text('Marketing Services\nand Revenue Share\nAgreement', 58, 190, { lineGap:5 });
        doc.moveTo(58, 330).lineTo(554, 330).lineWidth(2).strokeColor(purple).stroke();
        doc.fillColor('#BDBDCA').font('Helvetica').fontSize(10).text('PLATFORM OWNER', 58, 366).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text('Shamar Baker', 58, 383).font('Helvetica').fontSize(10).fillColor('#BDBDCA').text('trading as I Create Solutions & Services', 58, 401);
        doc.fillColor('#BDBDCA').text('MARKETING PARTNER', 58, 450).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(a.partner_name || '[Partner legal name]', 58, 467);
        doc.fillColor('#BDBDCA').font('Helvetica').fontSize(10).text('EFFECTIVE DATE', 340, 366).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(a.effective_date ? String(a.effective_date).slice(0,10) : 'Pending Owner completion', 340, 383);
        doc.fillColor('#BDBDCA').font('Helvetica').fontSize(10).text('GOVERNING LAW', 340, 450).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text('Jamaica', 340, 467);
        doc.roundedRect(58, 650, 496, 54, 9).fill('#1D1D2C');
        doc.fillColor('#AFAFC0').font('Helvetica').fontSize(9).text('PRIVATE & CONFIDENTIAL', 76, 670).fillColor('#FFFFFF').font('Helvetica-Bold').text(`Agreement ${a.id || 'Preview'}`, 330, 670, { width:205, align:'right' });

        doc.addPage();
        const paragraphs = agreementParagraphs();
        const start = Math.max(0, paragraphs.findIndex(p => p === 'MARKETING SERVICES AND REVENUE SHARE AGREEMENT'));
        for (const paragraph of paragraphs.slice(start + 1)) {
            const value = fill(paragraph, a);
            if (!value) continue;
            if (value === 'SIGNATURES') break;
            const majorHeading = /^(SCHEDULE\s+\d+|SIGNATURES|Agreement and Acceptance)/i.test(value);
            const sectionHeading = /^\d+\.\s/.test(value);
            const signatureLabel = /^(PLATFORM OWNER|MARKETING PARTNER)$/i.test(value);
            if (majorHeading || sectionHeading) {
                if (doc.y > 665) doc.addPage();
                doc.moveDown(0.45).fillColor(purple).font('Helvetica-Bold').fontSize(majorHeading ? 14 : 12).text(value, { paragraphGap:5 });
                doc.moveTo(58, doc.y).lineTo(554, doc.y).lineWidth(0.7).strokeColor('#D9D5F7').stroke().moveDown(0.55);
            } else if (signatureLabel) {
                doc.fillColor(purple).font('Helvetica-Bold').fontSize(10).text(value, { paragraphGap:4 });
            } else {
                const highlighted = paragraph.includes('[INSERT') || paragraph.includes('[INSTAGRAM /');
                const y = doc.y;
                if (highlighted) {
                    const height = doc.heightOfString(value, { width:476, lineGap:2 }) + 16;
                    doc.roundedRect(58, y - 5, 496, height, 6).fill(yellow);
                    doc.fillColor('#4A4020').font('Helvetica-Bold').fontSize(9.2).text(value, 68, y + 3, { width:476, lineGap:2, paragraphGap:9 });
                } else {
                    doc.fillColor(signatureLabel ? purple : ink).font('Helvetica').fontSize(9.2).text(value, { lineGap:2.2, paragraphGap:7, align:'left' });
                }
            }
        }
        doc.addPage().fillColor(ink).font('Helvetica-Bold').fontSize(18).text('Signatures').moveDown(0.25);
        doc.fillColor(muted).font('Helvetica').fontSize(9.2).text('Each Party confirms that it has read, understood and agreed to this Agreement and has had the opportunity to obtain independent legal, tax and professional advice before signing.', { lineGap:2, paragraphGap:18 });
        const signatureAsset = path.join(__dirname, '../assets/owner-signature.png');
        const signatureBlock = ({ y, title, legalName, signature, printedName, capacity, date, witnessName, witnessSignature, owner }) => {
            doc.roundedRect(58,y,496,218,10).fillAndStroke('#FAFAFD','#E1DFF0');
            doc.fillColor(purple).font('Helvetica-Bold').fontSize(10).text(title,76,y+17);
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('LEGAL NAME',76,y+43).fillColor(ink).font('Helvetica').fontSize(9.5).text(legalName||'Pending',76,y+56,{width:455});
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('SIGNATURE',76,y+82);
            if (owner && a.owner_signed_at && fs.existsSync(signatureAsset)) {
                try { doc.image(signatureAsset,76,y+91,{fit:[180,58],align:'left',valign:'center'}); } catch { doc.fillColor(ink).font('Helvetica-Oblique').fontSize(12).text(signature||'Shamar Baker',76,y+105); }
            } else doc.fillColor(ink).font(signature?'Helvetica-Oblique':'Helvetica').fontSize(signature?12:9.5).text(signature||'Pending',76,y+105,{width:180});
            doc.moveTo(76,y+151).lineTo(260,y+151).lineWidth(.6).strokeColor('#A9A6B7').stroke();
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('PRINTED NAME',282,y+82).fillColor(ink).font('Helvetica').fontSize(9.5).text(printedName||'Pending',282,y+97,{width:250});
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('TITLE / CAPACITY',282,y+122).fillColor(ink).font('Helvetica').fontSize(9.5).text(capacity||'Pending',282,y+137,{width:250});
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('DATE',76,y+166).fillColor(ink).font('Helvetica').fontSize(9.5).text(date||'Pending',76,y+181,{width:110});
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('WITNESS',205,y+166).fillColor(ink).font('Helvetica').fontSize(9.5).text(witnessName||'Pending',205,y+181,{width:145});
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text('WITNESS SIGNATURE',370,y+166).fillColor(ink).font(witnessSignature?'Helvetica-Oblique':'Helvetica').fontSize(9.5).text(witnessSignature||'Pending',370,y+181,{width:160});
        };
        signatureBlock({ y:145,title:'PLATFORM OWNER',legalName:'Shamar Baker, trading as I Create Solutions & Services',signature:a.owner_signature,printedName:a.owner_printed_name,capacity:a.owner_title,date:a.owner_signed_at?new Date(a.owner_signed_at).toISOString().slice(0,10):null,witnessName:a.owner_witness_name,witnessSignature:a.owner_witness_signature,owner:true });
        signatureBlock({ y:382,title:'MARKETING PARTNER',legalName:a.partner_name,signature:a.partner_signature,printedName:a.partner_name,capacity:a.partner_title,date:a.partner_signed_at?new Date(a.partner_signed_at).toISOString().slice(0,10):null,witnessName:a.partner_witness_name,witnessSignature:a.partner_witness_signature,owner:false });
        doc.addPage().fillColor(ink).font('Helvetica-Bold').fontSize(18).text('Electronic Signature Certificate').fillColor(muted).font('Helvetica').fontSize(9).text('This certificate is attached to and forms part of the agreement.', { paragraphGap:18 });
        const certificate = [
            ['Agreement ID', a.id || 'Preview'], ['Marketing Partner', `${a.partner_name || 'Pending'} · ${a.partner_email || '—'}`],
            ['Partner signature', a.partner_signature || 'Pending'], ['Partner capacity', a.partner_title || 'Pending'],
            ['Partner signed', a.partner_signed_at ? new Date(a.partner_signed_at).toISOString() : 'Pending'], ['Partner signing IP', a.partner_signing_ip || 'Pending'],
            ['Partner witness', `${a.partner_witness_name || 'Pending'} · ${a.partner_witness_signature || 'Pending'}`],
            ['Owner signature', a.owner_signature || 'Pending'], ['Owner printed name', a.owner_printed_name || 'Pending'],
            ['Owner capacity', a.owner_title || 'Pending'], ['Owner signed', a.owner_signed_at ? new Date(a.owner_signed_at).toISOString() : 'Pending'],
            ['Owner witness', `${a.owner_witness_name || 'Pending'} · ${a.owner_witness_signature || 'Pending'}`]
        ];
        certificate.forEach(([label,value], index) => {
            const y=doc.y;
            doc.roundedRect(58,y,496,36,5).fill(index%2?pale:'#FAFAFD');
            doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(),70,y+8,{width:130});
            if (label === 'Owner signature' && a.owner_signed_at && fs.existsSync(signatureAsset)) {
                try { doc.image(signatureAsset,205,y+3,{fit:[105,30]}); } catch { doc.fillColor(ink).font('Helvetica').fontSize(9).text(String(value),205,y+8,{width:335}); }
            } else doc.fillColor(ink).font('Helvetica').fontSize(9).text(String(value),205,y+8,{width:335});
            doc.y=y+42;
        });
        const range = doc.bufferedPageRange();
        for (let i = 1; i < range.count; i++) { doc.switchToPage(i); doc.rect(0,0,612,7).fill(purple); doc.font('Helvetica-Bold').fontSize(8).fillColor(purple).text('ICSS BOOKING SYSTEM',58,28,{lineBreak:false}); doc.font('Helvetica').fillColor('#77778A').text(`PRIVATE & CONFIDENTIAL · PAGE ${i + 1} OF ${range.count}`,350,28,{align:'right',width:204,lineBreak:false}); }
        doc.end();
    });
}

module.exports = { TEMPLATE_PATH, agreementParagraphs, generateAgreementPdf };
