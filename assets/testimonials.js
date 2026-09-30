/*
  Testimonials carousel.
  Moves by setting --tm-index on the track; CSS does the transition.
  Swipe/drag uses Pointer Events and only takes over once the gesture is
  clearly horizontal, so vertical page scrolling on touch keeps working.
*/
(function () {
  if (window.LumenTestimonials) return;
  window.LumenTestimonials = true;

  var DRAG_START = 8;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function init(root) {
    if (root.hasAttribute('data-testimonials-ready')) return;

    var viewport = root.querySelector('[data-testimonials-viewport]');
    var track = root.querySelector('[data-testimonials-track]');
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-testimonials-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-testimonials-dot]'));
    var prev = root.querySelector('[data-testimonials-prev]');
    var next = root.querySelector('[data-testimonials-next]');
    var status = root.querySelector('[data-testimonials-status]');
    if (!viewport || !track || slides.length < 2) return;

    root.setAttribute('data-testimonials-ready', '');

    var count = slides.length;
    var index = 0;
    var gesture = null;
    var suppressClick = false;
    var autoplayDelay = parseInt(root.getAttribute('data-autoplay'), 10) || 0;
    var autoplayTimer = 0;
    var paused = false;

    function goTo(target, announce) {
      index = Math.min(count - 1, Math.max(0, target));
      track.style.setProperty('--tm-index', String(index));

      slides.forEach(function (slide, n) {
        var active = n === index;
        slide.classList.toggle('is-active', active);
        if (active) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
        var links = slide.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
          if (active) links[i].removeAttribute('tabindex');
          else links[i].setAttribute('tabindex', '-1');
        }
      });

      dots.forEach(function (dot, n) {
        if (n === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });

      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === count - 1;
      if (announce && status) status.textContent = 'Testimonial ' + (index + 1) + ' of ' + count;
      scheduleAutoplay();
    }

    function slideWidth() {
      return slides[index].getBoundingClientRect().width || viewport.clientWidth;
    }

    function setDrag(px) {
      track.style.setProperty('--tm-drag', px + 'px');
    }

    // Swipe and drag

    viewport.addEventListener('pointerdown', function (event) {
      if (gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (event.target.closest('a, button')) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
      pause(true);
    });

    viewport.addEventListener('pointermove', function (event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      var dx = event.clientX - gesture.x;
      var dy = event.clientY - gesture.y;

      if (!gesture.dragging) {
        if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) {
          if (Math.abs(dy) > DRAG_START) {
            gesture = null;
            pause(false);
          }
          return;
        }
        gesture.dragging = true;
        viewport.classList.add('is-dragging');
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer already released; the drag still ends on pointerup.
        }
      }

      var atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
      gesture.dx = atEdge ? dx * 0.3 : dx;
      setDrag(gesture.dx);
    });

    function endGesture(event) {
      if (!gesture || (event && event.pointerId !== gesture.id)) return;
      var wasDragging = gesture.dragging;
      var dx = gesture.dx;
      gesture = null;
      viewport.classList.remove('is-dragging');
      setDrag(0);
      pause(false);
      if (!wasDragging) return;

      // Mouse drags end with a click that must be ignored; touch swipes usually don't fire one.
      suppressClick = true;
      window.setTimeout(function () {
        suppressClick = false;
      }, 0);
      var threshold = Math.min(90, slideWidth() * 0.18);
      if (dx <= -threshold) goTo(index + 1, true);
      else if (dx >= threshold) goTo(index - 1, true);
    }

    viewport.addEventListener('pointerup', endGesture);
    viewport.addEventListener('pointercancel', endGesture);
    viewport.addEventListener('lostpointercapture', endGesture);

    // A click on a partly visible neighbour brings it forward; a click that ends a drag does nothing.
    viewport.addEventListener(
      'click',
      function (event) {
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        var slide = event.target.closest('[data-testimonials-slide]');
        var n = slides.indexOf(slide);
        if (n > -1 && n !== index) {
          event.preventDefault();
          goTo(n, true);
        }
      },
      true
    );

    // Buttons and keyboard

    if (prev) prev.addEventListener('click', function () { goTo(index - 1, true); });
    if (next) next.addEventListener('click', function () { goTo(index + 1, true); });

    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function () { goTo(n, true); });
    });

    root.addEventListener('keydown', function (event) {
      if (!event.target.closest('.testimonials__carousel')) return;
      var target;
      if (event.key === 'ArrowLeft') target = index - 1;
      else if (event.key === 'ArrowRight') target = index + 1;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = count - 1;
      else return;
      event.preventDefault();
      goTo(target, true);
      if (event.target.hasAttribute('data-testimonials-dot') && dots[index]) dots[index].focus();
    });

    // Optional autoplay (off by default, never with reduced motion)

    function scheduleAutoplay() {
      window.clearTimeout(autoplayTimer);
      if (!autoplayDelay || paused || reducedMotion.matches) return;
      autoplayTimer = window.setTimeout(function () {
        goTo(index === count - 1 ? 0 : index + 1, false);
      }, autoplayDelay);
    }

    function pause(state) {
      paused = state;
      scheduleAutoplay();
    }

    if (autoplayDelay) {
      root.addEventListener('mouseenter', function () { pause(true); });
      root.addEventListener('mouseleave', function () { pause(false); });
      root.addEventListener('focusin', function () { pause(true); });
      root.addEventListener('focusout', function (event) {
        if (!root.contains(event.relatedTarget)) pause(false);
      });
    }

    // Theme editor: selecting a block shows its slide.
    root.addEventListener('shopify:block:select', function (event) {
      var n = slides.indexOf(event.target);
      if (n > -1) goTo(n, false);
      pause(true);
    });
    root.addEventListener('shopify:block:deselect', function () { pause(false); });

    goTo(0, false);
  }

  function initAll(scope) {
    var roots = (scope || document).querySelectorAll('[data-testimonials]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  initAll();

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
