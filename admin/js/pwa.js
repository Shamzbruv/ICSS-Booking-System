/* Installation belongs only to the admin app. No credentials enter its manifest. */
(() => {
    let installPrompt;
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        document.getElementById('installAdminApp')?.remove();
    });

    document.addEventListener('DOMContentLoaded', () => {
        if ('serviceWorker' in navigator && window.isSecureContext) {
            navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/', updateViaCache: 'none' })
                .catch((error) => console.warn('Admin app setup unavailable:', error.message));
        }
        if (standalone()) return;
        const target = document.querySelector('.sidebar-footer') || document.querySelector('.login-card');
        if (!target) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'installAdminApp';
        button.className = 'btn btn-secondary app-install-button';
        button.textContent = '↓ Install app';
        target.prepend(button);
        button.addEventListener('click', async () => {
            if (installPrompt) {
                const prompt = installPrompt;
                installPrompt = null;
                await prompt.prompt();
                const choice = await prompt.userChoice;
                if (choice.outcome === 'accepted') button.remove();
                return;
            }
            let dialog = document.getElementById('adminInstallHelp');
            if (!dialog) {
                dialog = document.createElement('dialog');
                dialog.id = 'adminInstallHelp';
                dialog.className = 'app-install-dialog';
                dialog.innerHTML = '<h2>Install ICSS Bookings</h2><p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p><p>On iPhone or iPad, open this page in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> and <strong>Add</strong>.</p><p>Your app opens the admin dashboard. Sign in with your usual account. An internet connection is needed to manage bookings and invoices.</p><form method="dialog"><button class="btn btn-primary">Got it</button></form>';
                document.body.appendChild(dialog);
            }
            dialog.showModal();
        });
    });
})();
