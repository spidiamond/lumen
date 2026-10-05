/*
  About page motion. Reads scroll position only.
  It does not replace native scrolling.
*/
(function () {
  if (window.LumenAbout) return;
  window.LumenAbout = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('about-js');
    return;
  }

  var revealIO = new IntersectionObserver(onReveal, {
    threshold: 0.28,
    rootMargin: '0px 0px -6% 0px'
  });

  function onReveal(entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('is-in');
      el.querySelectorAll('[data-about-line]').forEach(function (line, index) {
        line.style.transitionDelay = (index * 110) + 'ms';
        line.classList.add('is-in');
      });
      revealIO.unobserve(el);
    });
  }

  function boot(scope) {
    var root = scope || document;
    root.querySelectorAll('[data-about-lines], [data-about-watch]').forEach(function (el) {
      if (el.getAttribute('data-about-bound') === 'true') return;
      el.setAttribute('data-about-bound', 'true');
      if (reduce) {
        el.classList.add('is-in');
        el.querySelectorAll('[data-about-line]').forEach(function (line) {
          line.classList.add('is-in');
        });
        return;
      }
      revealIO.observe(el);
    });
    if (!reduce) requestTick();
  }

  var ticking = false;

  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      updateParallax();
      updatePrinciples();
      updateStory();
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateParallax() {
    if (reduce) return;
    document.querySelectorAll('[data-about-parallax]').forEach(function (el) {
      var mode = el.getAttribute('data-about-parallax');
      var shift = 0;
      if (mode === 'story') {
        var section = el.closest('[data-about-story]');
        if (!section) return;
        var bounds = section.getBoundingClientRect();
        var progress = (window.innerHeight - bounds.top) / (bounds.height + window.innerHeight);
        shift = clamp((progress - 0.5) * 22, -12, 12);
      } else {
        var rect = el.getBoundingClientRect();
        var delta = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        shift = clamp(delta * -26, -18, 18);
      }
      el.style.setProperty('--about-shift', shift.toFixed(2));
    });
  }

  function updatePrinciples() {
    if (reduce) return;
    document.querySelectorAll('[data-about-principles]').forEach(function (section) {
      var items = section.querySelectorAll('[data-principle]');
      var list = section.querySelector('[data-principle-list]');
      if (!items.length || !list) return;
      var rect = list.getBoundingClientRect();
      var start = window.innerHeight * 0.58;
      var progress = rect.height > 0 ? (start - rect.top) / rect.height : 0;
      progress = clamp(progress, 0, 1);
      section.style.setProperty('--about-progress', progress.toFixed(4));
      var index = Math.min(items.length - 1, Math.floor(progress * items.length));
      if (progress >= 0.98) index = items.length - 1;
      if (progress <= 0) index = 0;
      items.forEach(function (item, itemIndex) {
        item.classList.toggle('is-active', itemIndex === index);
      });
      section.classList.add('is-enhanced');
    });
  }

  function updateStory() {
    var desktop = window.innerWidth >= 900;
    document.querySelectorAll('[data-about-story]').forEach(function (section) {
      var chapters = section.querySelectorAll('[data-story-chapter]');
      var frames = section.querySelectorAll('[data-story-frame]');
      var stage = section.querySelector('[data-story-stage]');
      if (stage) stage.classList.add('is-live');
      if (!desktop) {
        frames.forEach(function (frame) { frame.classList.add('is-active'); });
        chapters.forEach(function (chapter) { chapter.classList.add('is-active'); });
        section.classList.remove('is-enhanced');
        return;
      }
      var mark = window.innerHeight * 0.46;
      var active = 0;
      var best = Infinity;
      chapters.forEach(function (chapter, index) {
        var rect = chapter.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var distance = Math.abs(center - mark);
        if (distance < best) {
          best = distance;
          active = index;
        }
      });
      frames.forEach(function (frame, index) {
        frame.classList.toggle('is-active', index === active);
      });
      chapters.forEach(function (chapter, index) {
        chapter.classList.toggle('is-active', index === active);
      });
      section.classList.add('is-enhanced');
    });
  }

  boot(document);
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick, { passive: true });
  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  if (!reduce) requestTick();
})();
