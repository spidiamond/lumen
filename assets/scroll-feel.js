/*
  A short settle after a mouse-wheel notch.
  The wheel itself stays native. Trackpads, touch, and the scrollbar are left alone.
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

  function cancel() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
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
    if (Math.abs(distance) < 6) return;

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
      else frame = 0;
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

  window.addEventListener('pointerdown', cancel, { passive: true });
  window.addEventListener('keydown', function (event) {
    var key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown' || key === 'Home' || key === 'End' || key === ' ') {
      cancel();
    }
  }, { passive: true });
})();
