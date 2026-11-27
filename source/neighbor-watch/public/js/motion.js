(() => {
  'use strict';
  const start = () => {
    const scene = document.getElementById('booth-scene');
    if (!scene || scene.dataset.referenceMotion === 'ready') return;
    scene.dataset.referenceMotion = 'ready';
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = id => document.getElementById(id);
    const display = $('visitor-display');
    const line = $('visitor-line');
    let firstArrivalShown = false;
    let typingToken = 0;
    let typingTimer = 0;
    let isTypingLine = false;

    // The uploaded visitor screenshot is displayed as-is for the arrival beat.
    const curtain = document.createElement('div');
    curtain.className = 'source-image-curtain';
    curtain.setAttribute('aria-label', '送付された来訪者の画像');
    curtain.innerHTML = '<img src="/assets/visitor-arrival.jpg" alt="来訪者の元画像">';
    scene.appendChild(curtain);
    const hideCurtain = () => {
      curtain.classList.add('is-hiding');
      curtain.classList.remove('is-visible');
      window.setTimeout(() => curtain.remove(), 360);
    };
    curtain.addEventListener('click', hideCurtain);

    const phone = $('phone');
    const dial = $('phone-dial');
    const center = phone && phone.querySelector('.phone-center');
    const callButton = $('dial-call');
    const lamp = $('alarm-lamp');
    const emergencyButton = $('emergency-button');
    const frame = $('window-frame');
    const folder = $('folder-button');
    const checklist = $('checklist-items');
    const calendarGrid = document.querySelector('.calendar-grid');

    function ringPhone() {
      if (reduced || !phone) return;
      phone.classList.remove('phone-ringing');
      void phone.offsetWidth;
      phone.classList.add('phone-ringing');
      window.setTimeout(() => phone.classList.remove('phone-ringing'), 760);
    }

    function animateVisitor() {
      if (!display || display.hidden) return;
      if (!reduced) {
        display.classList.remove('visitor-arriving');
        void display.offsetWidth;
        display.classList.add('visitor-arriving');
      }
      ringPhone();
      if (!firstArrivalShown) {
        firstArrivalShown = true;
        curtain.classList.add('is-visible');
        if (reduced) curtain.style.animation = 'none';
        window.setTimeout(hideCurtain, 1500);
      }
    }

    if (display) {
      const observer = new MutationObserver(records => {
        if (records.some(record => record.attributeName === 'hidden') && !display.hidden) animateVisitor();
      });
      observer.observe(display, { attributes: true, attributeFilter: ['hidden'] });
      if (!display.hidden) animateVisitor();
    }

    function typeLine(value) {
      const token = ++typingToken;
      window.clearTimeout(typingTimer);
      if (!line) return;
      const text = String(value || '');
      if (reduced || text.length < 2) { isTypingLine = false; line.textContent = text; return; }
      const chars = Array.from(text);
      isTypingLine = true;
      line.textContent = '';
      let index = 0;
      const tick = () => {
        if (token !== typingToken) return;
        index = Math.min(chars.length, index + 1);
        line.textContent = chars.slice(0, index).join('');
        if (index < chars.length) typingTimer = window.setTimeout(tick, 22);
        else isTypingLine = false;
      };
      tick();
    }
    if (line) {
      const observer = new MutationObserver(() => {
        if (isTypingLine) return;
        const value = line.textContent || '';
        if (line.dataset.motionText !== value) {
          line.dataset.motionText = value;
          typeLine(value);
        }
      });
      observer.observe(line, { childList: true, characterData: true, subtree: true });
      line.dataset.motionText = line.textContent || '';
    }

    if (dial) {
      dial.addEventListener('click', event => {
        if (!event.target.closest('button[data-digit]') || reduced) return;
        dial.classList.remove('is-dialing');
        void dial.offsetWidth;
        dial.classList.add('is-dialing');
        window.setTimeout(() => dial.classList.remove('is-dialing'), 660);
      });
    }
    if (center && callButton) {
      center.setAttribute('role', 'button');
      center.setAttribute('aria-label', '電話を発信');
      center.addEventListener('click', () => callButton.click());
    }

    if (emergencyButton) {
      emergencyButton.addEventListener('click', () => {
        if (lamp) lamp.classList.add('active');
        if (frame) frame.classList.add('alert-shutter');
        window.setTimeout(() => {
          if (lamp) lamp.classList.remove('active');
          if (frame) frame.classList.remove('alert-shutter');
        }, 1900);
      });
    }
    if (folder) {
      folder.addEventListener('click', () => {
        if (reduced) return;
        folder.classList.remove('folder-opening');
        void folder.offsetWidth;
        folder.classList.add('folder-opening');
        window.setTimeout(() => folder.classList.remove('folder-opening'), 360);
      });
    }
    if (checklist) {
      checklist.addEventListener('click', event => {
        const button = event.target.closest('.check-row button');
        if (!button || reduced) return;
        const row = button.closest('.check-row');
        if (!row) return;
        row.classList.remove('motion-stamp');
        void row.offsetWidth;
        row.classList.add('motion-stamp');
        window.setTimeout(() => row.classList.remove('motion-stamp'), 340);
      });
    }

    // Animate the application cards only when the game makes them available.
    ['id-document', 'form-document'].forEach(id => {
      const card = $(id);
      if (!card) return;
      const observer = new MutationObserver(records => {
        if (records.some(record => record.attributeName === 'disabled') && !card.disabled && !reduced) {
          card.classList.remove('paper-landing');
          void card.offsetWidth;
          card.classList.add('paper-landing');
          window.setTimeout(() => card.classList.remove('paper-landing'), 380);
        }
      });
      observer.observe(card, { attributes: true, attributeFilter: ['disabled'] });
    });

    // Use the submitted reference paperwork itself for Albertsky's application.
    function openReferenceApplication(event, card) {
      if (!card) return;
      const name = ($('form-doc-name')?.textContent || '').trim();
      if (name !== 'Albertsky Peachman') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const backdrop = $('modal-backdrop');
      const modal = $('modal-window');
      const content = $('modal-content');
      if (!backdrop || !modal || !content) return;
      modal.classList.add('source-document-open');
      content.innerHTML = '<div class="source-document-image"><img src="/assets/albertsky-entry-request.jpg" alt="Albertsky Peachman Entry Request — 元画像"><button type="button" aria-label="書類を閉じる"></button></div>';
      backdrop.hidden = false;
      content.querySelector('button').addEventListener('click', () => {
        backdrop.hidden = true;
        modal.classList.remove('source-document-open');
        content.innerHTML = '';
      });
    }
    document.addEventListener('click', event => {
      const card = event.target.closest && event.target.closest('#form-document');
      if (card) openReferenceApplication(event, card);
    }, true);
    const backdrop = $('modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => {
      const modal = $('modal-window');
      if (modal && modal.classList.contains('source-document-open')) {
        window.setTimeout(() => {
          if (backdrop.hidden) {
            modal.classList.remove('source-document-open');
            $('modal-content').innerHTML = '';
          }
        }, 0);
      }
    });

    if (calendarGrid) {
      const observer = new MutationObserver(records => {
        if (!records.some(record => record.attributeName === 'class') || reduced) return;
        calendarGrid.classList.remove('calendar-flip');
        void calendarGrid.offsetWidth;
        calendarGrid.classList.add('calendar-flip');
        window.setTimeout(() => calendarGrid.classList.remove('calendar-flip'), 380);
      });
      calendarGrid.querySelectorAll('i').forEach(day => observer.observe(day, { attributes: true, attributeFilter: ['class'] }));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
