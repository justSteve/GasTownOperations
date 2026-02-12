/**
 * Gas Town Operations - Help/Bug Widget for Presentations
 *
 * Self-contained widget that provides interactive help and bug reporting
 * for reveal.js presentations. Gathers slide context and presentation
 * manifest data, sends to Claude API via local proxy, and displays
 * the response in a modal dialog.
 *
 * Usage: include in any presentation before </body>:
 *   <link rel="stylesheet" href="../shared/widget.css">
 *   <script src="../shared/widget.js"></script>
 */
(function () {
    'use strict';

    var PROXY_URL = 'http://localhost:3141/api/chat';
    var manifest = null;
    var currentMode = 'question'; // 'question' or 'bug'

    // ---------------------------------------------------------------
    // DOM Construction
    // ---------------------------------------------------------------

    function buildWidget() {
        // Trigger button
        var btn = document.createElement('button');
        btn.className = 'gtops-help-btn';
        btn.textContent = '?';
        btn.title = 'Help / Report Bug';
        btn.setAttribute('aria-label', 'Open help widget');

        // Backdrop
        var backdrop = document.createElement('div');
        backdrop.className = 'gtops-widget-backdrop';

        // Dialog
        var dialog = document.createElement('div');
        dialog.className = 'gtops-widget-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-label', 'Help and Bug Report');
        dialog.innerHTML = [
            '<div class="gtops-widget-header">',
            '  <h3>Presentation Assistant</h3>',
            '  <button class="gtops-widget-close" aria-label="Close">&times;</button>',
            '</div>',
            '<div class="gtops-widget-tabs">',
            '  <button class="gtops-widget-tab active" data-mode="question">Ask a Question</button>',
            '  <button class="gtops-widget-tab" data-mode="bug">Report a Bug</button>',
            '</div>',
            '<div class="gtops-widget-body">',
            '  <div class="gtops-widget-context"></div>',
            '  <textarea placeholder="Type your question about this slide..."></textarea>',
            '  <button class="gtops-widget-submit">Send</button>',
            '  <div class="gtops-widget-loading"><div class="gtops-widget-spinner"></div><span>Thinking...</span></div>',
            '  <div class="gtops-widget-error"></div>',
            '  <div class="gtops-widget-response"></div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(btn);
        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);

        return {
            btn: btn,
            backdrop: backdrop,
            dialog: dialog,
            closeBtn: dialog.querySelector('.gtops-widget-close'),
            tabs: dialog.querySelectorAll('.gtops-widget-tab'),
            textarea: dialog.querySelector('textarea'),
            submitBtn: dialog.querySelector('.gtops-widget-submit'),
            loading: dialog.querySelector('.gtops-widget-loading'),
            error: dialog.querySelector('.gtops-widget-error'),
            response: dialog.querySelector('.gtops-widget-response'),
            context: dialog.querySelector('.gtops-widget-context')
        };
    }

    // ---------------------------------------------------------------
    // Manifest Loading
    // ---------------------------------------------------------------

    function loadManifest() {
        // Determine manifest path relative to current page
        var basePath = window.location.pathname.replace(/\/[^/]*$/, '');
        var manifestUrl = basePath + '/manifest.json';

        // For file:// protocol, construct differently
        if (window.location.protocol === 'file:') {
            // Try relative path from the HTML file
            manifestUrl = './manifest.json';
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', manifestUrl, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
                    try {
                        manifest = JSON.parse(xhr.responseText);
                    } catch (e) {
                        console.warn('[widget] Failed to parse manifest.json:', e.message);
                    }
                } else {
                    console.warn('[widget] No manifest.json found (status ' + xhr.status + '). Widget will work with reduced context.');
                }
            }
        };
        try {
            xhr.send();
        } catch (e) {
            console.warn('[widget] Could not load manifest.json:', e.message);
        }
    }

    // ---------------------------------------------------------------
    // Slide Context Gathering
    // ---------------------------------------------------------------

    function getSlideContext() {
        var result = {
            slideIndex: 0,
            slideTitle: '',
            slideContent: '',
            speakerNotes: '',
            totalSlides: 0
        };

        // Detect reveal.js
        if (typeof Reveal === 'undefined') {
            return result;
        }

        var indices = Reveal.getIndices();
        result.slideIndex = indices.h || 0;
        result.totalSlides = Reveal.getTotalSlides ? Reveal.getTotalSlides() : 0;

        var currentSlide = Reveal.getCurrentSlide();
        if (!currentSlide) return result;

        // Extract title from h1, h2, or h3
        var heading = currentSlide.querySelector('h1, h2, h3');
        if (heading) {
            result.slideTitle = heading.textContent.trim();
        }

        // Extract visible text content (excluding aside.notes)
        var clone = currentSlide.cloneNode(true);
        var notes = clone.querySelectorAll('aside.notes');
        for (var i = 0; i < notes.length; i++) {
            notes[i].parentNode.removeChild(notes[i]);
        }
        result.slideContent = clone.textContent.trim().replace(/\s+/g, ' ').substring(0, 2000);

        // Extract speaker notes
        var notesEl = currentSlide.querySelector('aside.notes');
        if (notesEl) {
            result.speakerNotes = notesEl.textContent.trim().substring(0, 2000);
        }

        return result;
    }

    // ---------------------------------------------------------------
    // System Message Construction
    // ---------------------------------------------------------------

    function buildSystemMessage(slideCtx) {
        var parts = [];

        parts.push('You are a knowledgeable assistant for a Gas Town Operations presentation.');
        parts.push('');

        if (manifest) {
            parts.push('PRESENTATION: ' + manifest.title + ' -- ' + (manifest.subtitle || ''));
            if (manifest.narrativeArc) {
                parts.push('NARRATIVE ARC: ' + manifest.narrativeArc);
            }
            if (manifest.description) {
                parts.push('DESCRIPTION: ' + manifest.description);
            }
            parts.push('');
        }

        var slideNum = slideCtx.slideIndex + 1;
        var totalSlides = (manifest && manifest.slideCount) ? manifest.slideCount : slideCtx.totalSlides;
        parts.push('CURRENT SLIDE (' + slideNum + ' of ' + totalSlides + '): ' + slideCtx.slideTitle);

        if (manifest && manifest.slides && manifest.slides[slideCtx.slideIndex]) {
            var slideMeta = manifest.slides[slideCtx.slideIndex];
            if (slideMeta.role) {
                parts.push('SLIDE ROLE: ' + slideMeta.role);
            }
        }

        if (slideCtx.slideContent) {
            parts.push('SLIDE CONTENT: ' + slideCtx.slideContent);
        }
        if (slideCtx.speakerNotes) {
            parts.push('SPEAKER NOTES: ' + slideCtx.speakerNotes);
        }

        if (manifest && manifest.connections && manifest.connections.length) {
            parts.push('');
            parts.push('RELATED PRESENTATIONS: ' + manifest.connections.join(', '));
        }

        parts.push('');

        if (currentMode === 'bug') {
            parts.push('The user is reporting a presentation issue. Acknowledge the bug, suggest what might fix it, and note it for the development team.');
        } else {
            parts.push('The user is viewing this presentation and has a question about the content.');
        }

        parts.push('Answer concisely. Use plain text formatting. If referencing slide content, be specific.');

        return parts.join('\n');
    }

    // ---------------------------------------------------------------
    // API Call
    // ---------------------------------------------------------------

    function sendToProxy(systemMsg, userMsg, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', PROXY_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 60000;

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    var text = '';
                    if (data.content && data.content.length > 0) {
                        text = data.content[0].text || '';
                    }
                    callback(null, text);
                } catch (e) {
                    callback('Failed to parse response: ' + e.message);
                }
            } else if (xhr.status === 0) {
                callback('Help service unavailable. Start the proxy with:\n\nANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs');
            } else {
                var errMsg = 'Error (' + xhr.status + ')';
                try {
                    var errData = JSON.parse(xhr.responseText);
                    if (errData.error) errMsg = errData.error;
                } catch (e) { /* ignore parse error */ }
                callback(errMsg);
            }
        };

        xhr.ontimeout = function () {
            callback('Request timed out. Please try again.');
        };

        var body = JSON.stringify({
            system: systemMsg,
            messages: [{ role: 'user', content: userMsg }]
        });

        try {
            xhr.send(body);
        } catch (e) {
            callback('Help service unavailable. Start the proxy with:\n\nANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs');
        }
    }

    // ---------------------------------------------------------------
    // Simple Markdown-ish Rendering
    // ---------------------------------------------------------------

    function renderMarkdown(text) {
        // Escape HTML
        var escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold: **text**
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Inline code: `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Line breaks
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    // ---------------------------------------------------------------
    // Update Context Indicator
    // ---------------------------------------------------------------

    function updateContextIndicator(els) {
        var ctx = getSlideContext();
        var slideNum = ctx.slideIndex + 1;
        var total = (manifest && manifest.slideCount) ? manifest.slideCount : ctx.totalSlides;
        var title = ctx.slideTitle || 'Untitled';
        var presTitle = (manifest && manifest.title) ? manifest.title : 'Presentation';
        var hasManifest = manifest ? 'full context' : 'slide content only';

        els.context.innerHTML = '<span>' + presTitle + '</span> &middot; Slide ' + slideNum + '/' + total + ' &middot; ' + hasManifest;
    }

    // ---------------------------------------------------------------
    // Initialization
    // ---------------------------------------------------------------

    function init() {
        // Only activate in a browser environment with a .reveal container
        if (typeof document === 'undefined') return;
        if (!document.querySelector('.reveal')) return;

        loadManifest();
        var els = buildWidget();

        // --- Open / Close ---
        function openDialog() {
            els.backdrop.classList.add('open');
            els.dialog.classList.add('open');
            updateContextIndicator(els);
            els.textarea.focus();
        }

        function closeDialog() {
            els.backdrop.classList.remove('open');
            els.dialog.classList.remove('open');
        }

        els.btn.addEventListener('click', openDialog);
        els.closeBtn.addEventListener('click', closeDialog);
        els.backdrop.addEventListener('click', closeDialog);

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.dialog.classList.contains('open')) {
                closeDialog();
            }
        });

        // --- Tabs ---
        for (var t = 0; t < els.tabs.length; t++) {
            els.tabs[t].addEventListener('click', function () {
                for (var j = 0; j < els.tabs.length; j++) {
                    els.tabs[j].classList.remove('active');
                }
                this.classList.add('active');
                currentMode = this.getAttribute('data-mode');

                if (currentMode === 'bug') {
                    els.textarea.placeholder = 'Describe the issue you found in this slide...';
                } else {
                    els.textarea.placeholder = 'Type your question about this slide...';
                }
            });
        }

        // --- Submit ---
        function handleSubmit() {
            var userText = els.textarea.value.trim();
            if (!userText) return;

            // Reset state
            els.error.classList.remove('visible');
            els.error.textContent = '';
            els.response.classList.remove('visible');
            els.response.innerHTML = '';
            els.loading.classList.add('visible');
            els.submitBtn.disabled = true;

            var slideCtx = getSlideContext();
            var systemMsg = buildSystemMessage(slideCtx);

            var prefix = currentMode === 'bug' ? '[BUG REPORT] ' : '[QUESTION] ';

            sendToProxy(systemMsg, prefix + userText, function (err, text) {
                els.loading.classList.remove('visible');
                els.submitBtn.disabled = false;

                if (err) {
                    els.error.textContent = err;
                    els.error.classList.add('visible');
                    return;
                }

                els.response.innerHTML = renderMarkdown(text);
                els.response.classList.add('visible');
            });
        }

        els.submitBtn.addEventListener('click', handleSubmit);

        // Submit on Ctrl+Enter / Cmd+Enter
        els.textarea.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });

        // Update context when slides change
        if (typeof Reveal !== 'undefined' && Reveal.on) {
            Reveal.on('slidechanged', function () {
                if (els.dialog.classList.contains('open')) {
                    updateContextIndicator(els);
                }
            });
        }
    }

    // Wait for DOM and Reveal.js to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // Slight delay to let Reveal.js initialize first
            setTimeout(init, 500);
        });
    } else {
        setTimeout(init, 500);
    }
})();
