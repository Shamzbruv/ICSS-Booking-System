const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const PizZip = require('pizzip');

const TEMPLATE_PATH = path.join(__dirname, '../../ICSS_Booking_Marketing_Revenue_Share_Agreement.docx');
const decodeXml = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function agreementParagraphs() {
    const xml = new PizZip(fs.readFileSync(TEMPLATE_PATH)).file('word/document.xml').asText();
    return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(match => decodeXml(
        [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(run => run[1]).join('')
    ).trim()).filter(Boolean);
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
        const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 54, left: 58, right: 58 }, bufferPages: true });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        doc.font('Helvetica-Bold').fontSize(15).text('MARKETING AND REVENUE SHARE AGREEMENT', { align: 'center' }).moveDown();
        for (const paragraph of agreementParagraphs()) {
            const value = fill(paragraph, a);
            const heading = /^(SCHEDULE|SIGNATURES|[0-9]+\.\s|Agreement and Acceptance|PLATFORM OWNER|MARKETING PARTNER)/.test(value);
            doc.font(heading ? 'Helvetica-Bold' : 'Helvetica').fontSize(heading ? 10.5 : 9).text(value, { lineGap: 2, paragraphGap: 7, align: 'justify' });
        }
        doc.addPage().font('Helvetica-Bold').fontSize(14).text('ELECTRONIC SIGNATURE CERTIFICATE').moveDown().font('Helvetica').fontSize(10);
        [
            `Agreement ID: ${a.id}`, `Marketing Partner: ${a.partner_name || '—'} <${a.partner_email}>`,
            `Partner signature: ${a.partner_signature || '—'}`, `Partner capacity: ${a.partner_title || '—'}`,
            `Partner signed: ${a.partner_signed_at ? new Date(a.partner_signed_at).toISOString() : 'Pending'}`,
            `Partner signing IP: ${a.partner_signing_ip || '—'}`, `Partner witness: ${a.partner_witness_name || '—'} (${a.partner_witness_signature || '—'})`,
            '', `Owner signature: ${a.owner_signature || 'Pending'}`, `Owner printed name: ${a.owner_printed_name || 'Pending'}`,
            `Owner capacity: ${a.owner_title || 'Pending'}`, `Owner signed: ${a.owner_signed_at ? new Date(a.owner_signed_at).toISOString() : 'Pending'}`,
            `Owner witness: ${a.owner_witness_name || '—'} (${a.owner_witness_signature || '—'})`
        ].forEach(line => doc.text(line));
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) { doc.switchToPage(i); doc.fontSize(8).fillColor('#777').text(`ICSS Partner Agreement · ${a.id} · Page ${i + 1} of ${range.count}`, 58, 742, { align: 'center', width: 496 }); }
        doc.end();
    });
}

module.exports = { TEMPLATE_PATH, generateAgreementPdf };
