(() => {
  'use strict';

  const start = () => {
    const scene = document.getElementById('booth-scene');
    if (!scene || scene.dataset.referenceMotion === 'ready') return;
    scene.dataset.referenceMotion = 'ready';

    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const $ = id => document.getElementById(id);
    const display = $('visitor-display');
    const line = $('visitor-line');
    let firstArrivalShown = false;
    let typingToken = 0;
    let typingTimer = 0;
    let typingActive = false;

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
      firstArrivalShown = true;
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
      if (reduced || text.length < 2) {
        typingActive = false;
        line.textContent = text;
        return;
      }
      const chars = Array.from(text);
      typingActive = true;
      line.textContent = '';
      let index = 0;
      const tick = () => {
        if (token !== typingToken) return;
        index = Math.min(chars.length, index + 1);
        line.textContent = chars.slice(0, index).join('');
        if (index < chars.length) typingTimer = window.setTimeout(tick, 22);
        else typingActive = false;
      };
      tick();
    }

    if (line) {
      line.dataset.motionText = line.textContent || '';
      const observer = new MutationObserver(() => {
        if (typingActive) return;
        const value = line.textContent || '';
        if (line.dataset.motionText !== value) {
          line.dataset.motionText = value;
          typeLine(value);
        }
      });
      observer.observe(line, { childList: true, characterData: true, subtree: true });
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
      center.setAttribute('tabindex', '0');
      center.setAttribute('aria-label', '電話を発信');
      center.addEventListener('click', () => callButton.click());
      center.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          callButton.click();
        }
      });
    }

    // Mirror the actual game state. Do not run a timer that could undo a second click.
    if (emergencyButton) {
      const syncEmergencyAnimation = () => {
        const active = emergencyButton.classList.contains('pressed');
        if (lamp) lamp.classList.toggle('active', active);
        if (frame) frame.classList.toggle('alert-shutter', active);
      };
      const observer = new MutationObserver(syncEmergencyAnimation);
      observer.observe(emergencyButton, { attributes: true, attributeFilter: ['class'] });
      syncEmergencyAnimation();
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

    // The visitor portrait is a real, keyboard-accessible hit target.
    const visitorFace = $('visitor-face');
    const askButton = $('ask-button');
    if (visitorFace && askButton) {
      visitorFace.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          askButton.click();
        }
      });
    }

    // Use the original submitted form image only for Albertsky's application.
    function openReferenceApplication(event, card) {
      if (!card) return;
      const name = ($('form-doc-name')?.textContent || '').trim();
      if (name !== 'Albertsky Peachman') return;
      const backdrop = $('modal-backdrop');
      const modal = $('modal-window');
      const content = $('modal-content');
      if (!backdrop || !modal || !content) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      modal.classList.add('source-document-open');
      content.innerHTML = '<div class="source-document-image"><img src="/assets/albertsky-entry-request.jpg" alt="Albertsky Peachman Entry Request — 元画像"><button type="button" class="source-document-close" aria-label="書類を閉じる">×</button></div>';
      backdrop.hidden = false;
      content.querySelector('.source-document-close').addEventListener('click', () => {
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
    if (backdrop) {
      backdrop.addEventListener('click', event => {
        const modal = $('modal-window');
        if (event.target === backdrop && modal && modal.classList.contains('source-document-open')) {
          backdrop.hidden = true;
          modal.classList.remove('source-document-open');
          $('modal-content').innerHTML = '';
        }
      });
    }

    if (calendarGrid) {
      const observer = new MutationObserver(records => {
        if (!records.some(record => record.attributeName === 'class') || reduced) return;
        calendarGrid.classList.remove('calendar-flip');
        void calendarGrid.offsetWidth;
        calendarGrid.classList.add('calendar-flip');
        window.setTimeout(() => calendarGrid.classList.remove('calendar-flip'), 380);
      });
      calendarGrid.querySelectorAll('i').forEach(day =>
        observer.observe(day, { attributes: true, attributeFilter: ['class'] })
      );
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();