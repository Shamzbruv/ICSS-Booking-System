const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('tutorial engine refuses first-visit and forced automatic launches', () => {
    const window = {};
    vm.runInNewContext(read('admin/js/guidedTour.js'), { window });
    const tour = Object.create(window.GuidedTour.prototype);
    assert.equal(tour.start(), false);
    assert.equal(tour.start({ force: true }), false);
    assert.equal(tour.start({ stepIndex: 0 }), false);
});

function intentContext() {
    const storage = new Map();
    const context = {
        sessionStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) },
        getTenantSlug: () => 'business with spaces', location: {},
        document: { addEventListener() {} }, Date, showToast() {}
    };
    vm.createContext(context);
    const source = read('admin/js/admin.js');
    vm.runInContext(source.slice(source.indexOf('function requestAdminTutorial(kind)')), context);
    return { context, storage };
}

test('Settings manual intent launches the requested page and can be consumed only once', () => {
    const {context} = intentContext();
    context.requestAdminTutorial('builder');
    assert.equal(context.location.href, 'customize.html?tenant=business%20with%20spaces');
    assert.equal(context.consumeAdminTutorial('dashboard'), false);
    assert.equal(context.consumeAdminTutorial('builder'), true);
    assert.equal(context.consumeAdminTutorial('builder'), false);
});

test('stale walkthrough intent never launches on a later visit', () => {
    const {context,storage} = intentContext();
    storage.set('icss_manual_tour', JSON.stringify({kind:'dashboard', at:Date.now()-120000}));
    assert.equal(context.consumeAdminTutorial('dashboard'), false);
    assert.equal(storage.has('icss_manual_tour'), false);
});
