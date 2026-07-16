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
        for (let i = 1; i < range.count; i++) { doc.switchToPage(i); doc.rect(0,0,612,7).fill(purple); doc.font('Helvetica-Bold').fontSize(8).fillColor(purple).text('ICSS BOOKING SYSTEM',58,28); doc.font('Helvetica').fillColor('#77778A').text(`Private & confidential · ${a.id || 'Preview'} · Page ${i + 1} of ${range.count}`,58,748,{align:'right',width:496}); }
        doc.end();
    });
}

module.exports = { TEMPLATE_PATH, generateAgreementPdf };
