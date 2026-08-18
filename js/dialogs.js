/**
 * TeamAnalysis - By Loris Salerno (taasalo3) - Loris.Salerno@swisscom.com
 * Modali di dialogo personalizzati (alert / confirm / prompt) in sostituzione
 * dei popup nativi del browser ("Questa pagina dice").
 * API: window.appDialog.alert(msg, opts) -> Promise
 *      window.appDialog.confirm(msg, opts) -> Promise<boolean>
 *      window.appDialog.prompt(msg, opts) -> Promise<string|null>
 * opts: { title, okText, cancelText, defaultValue }
 */
(function () {
    'use strict';

    let overlay = null;
    let dialogEl = null;
    let titleEl = null;
    let messageEl = null;
    let inputWrap = null;
    let inputEl = null;
    let okBtn = null;
    let cancelBtn = null;
    let pendingResolver = null;

    function ensureDOM() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        overlay.innerHTML = `
            <div class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
                <div class="app-dialog-header">
                    <h2 id="app-dialog-title">TeamAnalysis</h2>
                </div>
                <div class="app-dialog-body">
                    <p id="app-dialog-message" class="app-dialog-message"></p>
                    <div class="app-dialog-input-wrap" id="app-dialog-input-wrap" style="display:none;">
                        <input type="text" id="app-dialog-input" class="app-dialog-input">
                    </div>
                </div>
                <div class="app-dialog-footer">
                    <button type="button" class="btn secondary" id="app-dialog-cancel">Annulla</button>
                    <button type="button" class="btn primary" id="app-dialog-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        dialogEl = overlay.querySelector('.app-dialog');
        titleEl = dialogEl.querySelector('#app-dialog-title');
        messageEl = dialogEl.querySelector('#app-dialog-message');
        inputWrap = dialogEl.querySelector('#app-dialog-input-wrap');
        inputEl = dialogEl.querySelector('#app-dialog-input');
        okBtn = dialogEl.querySelector('#app-dialog-ok');
        cancelBtn = dialogEl.querySelector('#app-dialog-cancel');

        okBtn.addEventListener('click', () => finish(true));
        cancelBtn.addEventListener('click', () => finish(false));
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            } else if (e.key === 'Enter' && e.target === inputEl) {
                e.preventDefault();
                finish(true);
            }
        });
    }

    function finish(confirmed) {
        const resolver = pendingResolver;
        pendingResolver = null;
        if (!dialogEl) return;
        const type = dialogEl.getAttribute('data-dialog-type') || 'alert';
        overlay.classList.remove('open');
        dialogEl.classList.remove('open');
        if (resolver) {
            if (type === 'alert') resolver();
            else if (type === 'confirm') resolver(confirmed);
            else if (type === 'prompt') resolver(confirmed ? inputEl.value : null);
        }
        if (inputEl) inputEl.value = '';
    }

    function openDialog(cfg) {
        ensureDOM();
        if (pendingResolver) finish(false);

        titleEl.textContent = cfg.title || 'TeamAnalysis';
        messageEl.textContent = cfg.message || '';
        dialogEl.setAttribute('data-dialog-type', cfg.type);

        const isPrompt = cfg.type === 'prompt';
        inputWrap.style.display = isPrompt ? 'block' : 'none';
        if (isPrompt) inputEl.value = (typeof cfg.defaultValue === 'string') ? cfg.defaultValue : '';
        cancelBtn.style.display = cfg.type === 'alert' ? 'none' : 'inline-flex';
        okBtn.textContent = cfg.okText || 'OK';
        cancelBtn.textContent = cfg.cancelText || 'Annulla';

        overlay.classList.add('open');
        dialogEl.classList.add('open');

        if (isPrompt) {
            inputEl.focus();
            inputEl.select();
        } else {
            okBtn.focus();
        }

        return new Promise(resolve => {
            pendingResolver = resolve;
        });
    }

    window.appDialog = {
        alert: (message, opts) => openDialog(Object.assign({ type: 'alert', message }, opts || {})),
        confirm: (message, opts) => openDialog(Object.assign({ type: 'confirm', message }, opts || {})),
        prompt: (message, opts) => openDialog(Object.assign({
            type: 'prompt',
            message,
            defaultValue: (opts && opts.defaultValue) || ''
        }, opts || {}))
    };
})();