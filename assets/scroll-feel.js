/*
  Native scrolling stays in charge.
  A mouse-wheel notch still gets the existing short momentum nudge.
  After movement has actually stopped, a nearby major section can ease
  into a cleaner resting position. The nudge is small, and it never runs
  while the user, the keyboard, or another gesture is still in control.
*/
(function () {
  if (window.LumenScrollFeel) return;
  window.LumenScrollFeel = true;

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  var velocity = 0;
  var trackpad = false;
  var timer = 0;
  var frame = 0;
  var magnetTimer = 0;
  var magnetizing = false;
  var direction = 0;
  var lastY = window.scrollY || 0;
  var suppressUntil = 0;
  var keyboardUntil = 0;
  var sliderHold = false;

  function cancel() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    magnetizing = false;
    window.clearTimeout(magnetTimer);
  }

  function ease(t) {
    var cx = 0.66;
    var bx = 0.42 - cx;
    var ax = 1 - cx - bx;
    var cy = 3;
    var by = -3;
    var ay = 1;
    var u = t;
    var i = 0;
    for (i = 0; i < 5; i++) {
      var x = ((ax * u + bx) * u + cx) * u - t;
      var dx = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(dx) < 1e-4) break;
      u -= x / dx;
    }
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    return ((ay * u + by) * u + cy) * u;
  }

  function headerOffset() {
    var header = document.querySelector('[data-site-header]');
    if (!header) return 0;
    var height = header.getBoundingClientRect().height;
    return height > 0 ? height : 0;
  }

  function blocked() {
    if (reduceQuery.matches) return true;
    if (performance.now() < suppressUntil || performance.now() < keyboardUntil) return true;
    if (sliderHold) return true;
    var root = document.documentElement;
    if (root.classList.contains('cart-open') || root.classList.contains('site-menu-locked')) return true;
    if (document.querySelector('dialog[open]')) return true;
    var active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return false;
    var tag = active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return true;
    return false;
  }

  function targets() {
    var headerH = headerOffset();
    var view = window.innerHeight;
    var available = Math.max(view - headerH, 1);
    var maxScroll = Math.max(document.documentElement.scrollHeight - view, 0);
    var scrollY = window.scrollY || 0;
    var minHeight = Math.min(280, available * 0.34);
    var list = [];
    var nodes = document.querySelectorAll('.shopify-section');
    var i = 0;

    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.classList.contains('shopify-section-group-header-group')) continue;
      if (node.classList.contains('shopify-section-group-footer-group')) continue;
      if (node.querySelector('.cart-root, [data-cart-toast]')) continue;
      var rect = node.getBoundingClientRect();
      if (rect.height < minHeight) continue;
      var top = rect.top + scrollY;
      var ideal = rect.height >= available * 0.92
        ? top - headerH
        : top - headerH - (available - rect.height) / 2;
      if (i === 0 || top < headerH) ideal = Math.min(ideal, top);
      if (top <= 1) ideal = 0;
      if (ideal < 0) ideal = 0;
      if (ideal > maxScroll) ideal = maxScroll;
      list.push(ideal);
    }

    return list;
  }

  function choose(list, scrollY) {
    var view = window.innerHeight;
    var fine = finePointer.matches;
    var limit = fine ? Math.min(120, view * 0.14) : Math.min(64, view * 0.09);
    var best = 0;
    var bestAbs = limit + 1;
    var i = 0;

    for (i = 0; i < list.length; i++) {
      var delta = list[i] - scrollY;
      var abs = Math.abs(delta);
      if (abs < 4 || abs > limit) continue;
      if (direction > 0 && delta < -18) continue;
      if (direction < 0 && delta > 18) continue;
      if (abs < bestAbs) {
        bestAbs = abs;
        best = delta;
      }
    }

    return bestAbs <= limit ? best : 0;
  }

  function focusWouldLeave(delta) {
    var active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return false;
    var rect = active.getBoundingClientRect();
    var headerH = headerOffset();
    var visible = rect.bottom > headerH && rect.top < window.innerHeight;
    if (!visible) return false;
    var nextTop = rect.top - delta;
    var nextBottom = rect.bottom - delta;
    return nextTop < headerH - 8 || nextBottom > window.innerHeight + 8;
  }

  function maybeMagnet() {
    magnetTimer = 0;
    if (frame || magnetizing || blocked()) return;
    var scrollY = window.scrollY || 0;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll < 8) return;
    var delta = choose(targets(), scrollY);
    if (!delta || focusWouldLeave(delta)) return;

    var distance = delta;
    var duration = 220 + Math.min(240, Math.abs(distance) * 1.8);
    if (duration > 480) duration = 480;
    var start = performance.now();
    var traveled = 0;
    magnetizing = true;

    function step(now) {
      var t = (now - start) / duration;
      if (t > 1) t = 1;
      var next = distance * ease(t);
      var move = next - traveled;
      traveled = next;
      if (move) window.scrollBy(0, move);
      if (t < 1) frame = window.requestAnimationFrame(step);
      else {
        frame = 0;
        magnetizing = false;
      }
    }

    frame = window.requestAnimationFrame(step);
  }

  function armMagnet() {
    window.clearTimeout(magnetTimer);
    if (reduceQuery.matches) return;
    var wait = finePointer.matches ? 130 : 260;
    magnetTimer = window.setTimeout(maybeMagnet, wait);
  }

  function settle() {
    trackpad = false;
    if (reduceQuery.matches || !finePointer.matches) {
      velocity = 0;
      return;
    }

    var distance = velocity;
    velocity = 0;
    if (distance > 48) distance = 48;
    if (distance < -48) distance = -48;
    if (Math.abs(distance) < 6) {
      armMagnet();
      return;
    }

    var start = performance.now();
    var duration = 180;
    var traveled = 0;

    function step(now) {
      var t = (now - start) / duration;
      if (t > 1) t = 1;
      var eased = 1 - Math.pow(1 - t, 3);
      var next = distance * eased;
      var delta = next - traveled;
      traveled = next;
      if (delta) window.scrollBy(0, delta);
      if (t < 1) frame = window.requestAnimationFrame(step);
      else {
        frame = 0;
        armMagnet();
      }
    }

    frame = window.requestAnimationFrame(step);
  }

  window.addEventListener('wheel', function (event) {
    if (reduceQuery.matches || !finePointer.matches) return;
    if (event.ctrlKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    cancel();

    var delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= window.innerHeight;

    if (event.deltaMode === 0 && (Math.abs(event.deltaY) < 50 || event.deltaY % 1 !== 0)) {
      trackpad = true;
    }

    if (!trackpad) {
      velocity = velocity * 0.45 + delta * 0.28;
      if (velocity > 48) velocity = 48;
      if (velocity < -48) velocity = -48;
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(settle, 80);
  }, { passive: true });

  window.addEventListener('scroll', function () {
    var y = window.scrollY || 0;
    var delta = y - lastY;
    lastY = y;
    if (Math.abs(delta) > 0.5) direction = delta > 0 ? 1 : -1;
    if (magnetizing || frame || performance.now() < suppressUntil) return;
    armMagnet();
  }, { passive: true });

  window.addEventListener('pointerdown', function (event) {
    cancel();
    sliderHold = !!(event.target && event.target.closest && event.target.closest('[data-skin-compare]'));
  }, { passive: true });

  window.addEventListener('pointerup', function () {
    sliderHold = false;
  }, { passive: true });

  window.addEventListener('pointercancel', function () {
    sliderHold = false;
  }, { passive: true });

  window.addEventListener('keydown', function (event) {
    var key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown' || key === 'Home' || key === 'End' || key === ' ') {
      cancel();
      keyboardUntil = performance.now() + 900;
    }
  }, { passive: true });

  document.addEventListener('click', function (event) {
    var source = event.target && event.target.closest ? event.target : event.target && event.target.parentElement;
    if (!source || !source.closest) return;
    var link = source.closest('a[href^="#"]');
    var toTop = source.closest('[data-back-to-top]');
    if (!link && !toTop) return;
    suppressUntil = performance.now() + 1400;
    cancel();
  }, true);
})();
