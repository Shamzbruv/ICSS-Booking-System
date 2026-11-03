const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareSiteConfig } = require('../server/services/siteMedia');
const { MAX_SITE_BYTES } = require('../server/services/siteConfig');

// PNG signature plus a representative legacy logo payload, checked by the
// same magic-byte validation used by the existing upload endpoint.
const image = Buffer.alloc(610 * 1024);
Buffer.from('89504e470d0a1a0a0000000d', 'hex').copy(image);
const inline = `data:image/png;base64,${image.toString('base64')}`;
const url = '/media/93fcb692-3c96-4c7e-8a7c-a926cf2782d0';

test('a large inherited logo saves as a media URL without losing website content', async () => {
    let uploaded;
    const original = { brand: { logoUrl: inline, name: 'Salon' }, pages: [{ id: 'home', sections: [{ type: 'hero', props: { headline: 'My own heading', imageUrl: 'https://example.com/photo.jpg' } }] }] };
    assert.ok(Buffer.byteLength(JSON.stringify(original)) > MAX_SITE_BYTES);
    const saved = await prepareSiteConfig(original, 'tenant-a', {
        findMedia: async () => null,
        saveMedia: async value => { uploaded = value; return { url }; }
    });
    assert.equal(saved.brand.logoUrl, url);
    assert.equal(saved.pages[0].sections[0].props.headline, 'My own heading');
    assert.equal(saved.pages[0].sections[0].props.imageUrl, 'https://example.com/photo.jpg');
    assert.deepEqual(uploaded.buffer, image);
    assert.ok(Buffer.byteLength(JSON.stringify(saved)) < MAX_SITE_BYTES);
    assert.equal(original.brand.logoUrl, inline);
});

test('duplicate embedded images upload once, including retries that find an existing asset', async () => {
    const original = { brand: { logoUrl: inline }, booking: { serviceSectionImageUrl: inline } };
    let uploads = 0, lookups = 0;
    const saved = await prepareSiteConfig(original, 'tenant-a', {
        findMedia: async () => { lookups++; return { url }; },
        saveMedia: async () => { uploads++; return { url }; }
    });
    assert.equal(lookups, 1); assert.equal(uploads, 0);
    assert.equal(saved.brand.logoUrl, url);
    assert.equal(saved.booking.serviceSectionImageUrl, url);
});

test('invalid embedded image bytes are rejected before any uploads', async () => {
    await assert.rejects(prepareSiteConfig({ brand: { logoUrl: 'data:image/png;base64,aGVsbG8=' } }, 'tenant-a', {
        findMedia: () => assert.fail('must not query media'),
        saveMedia: () => assert.fail('must not upload media')
    }), /invalid|could not be read/);
});

test('large text still exceeds the settings limit, with no orphan image uploads', async () => {
    await assert.rejects(prepareSiteConfig({ brand: { logoUrl: inline }, footer: { text: 'x'.repeat(300 * 1024) } }, 'tenant-a', {
        findMedia: () => assert.fail('document must be validated first'),
        saveMedia: () => assert.fail('document must be validated first')
    }), /too large/);
});

test('a media storage failure fails the save rather than removing the original logo', async () => {
    const original = { brand: { logoUrl: inline } };
    await assert.rejects(prepareSiteConfig(original, 'tenant-a', {
        findMedia: async () => null,
        saveMedia: async () => { throw new Error('Media storage unavailable'); }
    }), /Media storage unavailable/);
    assert.equal(original.brand.logoUrl, inline);
});
