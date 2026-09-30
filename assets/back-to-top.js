/*
  Scroll progress for the global back-to-top button.
  The ring follows the real scroll position. Hover is handled in CSS.
*/
(function () {
  if (window.LumenBackToTop) return;
  window.LumenBackToTop = true;

  var root = document.querySelector('[data-back-to-top]');
  if (!root) return;

  var progress = root.querySelector('.lumen-back-to-top__progress');
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var revealAfter = 220;
  var frame = 0;

  function update() {
    var distance = document.documentElement.scrollHeight - window.innerHeight;
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var amount = 0;

    if (distance > 1) {
      amount = scrollY / distance;
      if (amount < 0) amount = 0;
      if (amount > 1) amount = 1;
    }

    if (progress) {
      progress.setAttribute('stroke-dashoffset', String(100 - amount * 100));
    }

    var visible = distance > 1 && scrollY > revealAfter;
    root.classList.toggle('is-visible', visible);
    root.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) root.removeAttribute('tabindex');
    else root.setAttribute('tabindex', '-1');
  }

  function requestUpdate() {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      update();
    });
  }

  root.addEventListener('click', function () {
    window.scrollTo({
      top: 0,
      behavior: motionQuery.matches ? 'auto' : 'smooth'
    });
  });

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
})();
