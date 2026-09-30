/*
  Before / after comparison slider.
  Mouse: press anywhere on the image and drag. Touch: drag the divider
  (a wide invisible hit area), so vertical page scrolling over the image
  still works. Keyboard: arrows, Page Up/Down, Home, End on the handle.
*/
(function () {
  if (window.LumenSkinCompare) return;
  window.LumenSkinCompare = true;

  var SMALL_STEP = 2;
  var LARGE_STEP = 10;

  function clamp(value) {
    return Math.min(100, Math.max(0, value));
  }

  function init(frame) {
    if (frame.hasAttribute('data-skin-compare-ready')) return;
    var handle = frame.querySelector('[data-skin-compare-handle]');
    if (!handle) return;
    frame.setAttribute('data-skin-compare-ready', '');

    var beforeLabel = handle.getAttribute('data-before-label') || 'Before';
    var afterLabel = handle.getAttribute('data-after-label') || 'After';
    var position = 50;
    var pointerId = null;
    var grabOffset = 0;
    var rect = null;

    function setPosition(value) {
      position = clamp(value);
      frame.style.setProperty('--compare-position', position.toFixed(2) + '%');
      var rounded = Math.round(position);
      handle.setAttribute('aria-valuenow', String(rounded));
      handle.setAttribute(
        'aria-valuetext',
        rounded + '% ' + beforeLabel + ', ' + (100 - rounded) + '% ' + afterLabel
      );
    }

    function percentAt(clientX) {
      return ((clientX - rect.left) / rect.width) * 100;
    }

    function endDrag(event) {
      if (pointerId === null || (event && event.pointerId !== pointerId)) return;
      if (frame.hasPointerCapture(pointerId)) frame.releasePointerCapture(pointerId);
      pointerId = null;
      frame.classList.remove('is-dragging');
    }

    frame.addEventListener('pointerdown', function (event) {
      if (pointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      var onHandle = handle.contains(event.target);
      if (event.pointerType !== 'mouse' && !onHandle) return;

      rect = frame.getBoundingClientRect();
      if (!rect.width) return;

      pointerId = event.pointerId;
      grabOffset = onHandle ? percentAt(event.clientX) - position : 0;
      if (!onHandle) setPosition(percentAt(event.clientX));

      try {
        frame.setPointerCapture(pointerId);
      } catch (error) {
        // The pointer is already gone; moves still arrive while it stays over the frame.
      }
      frame.classList.add('is-dragging');
      if (event.pointerType === 'mouse') event.preventDefault();
    });

    frame.addEventListener('pointermove', function (event) {
      if (event.pointerId !== pointerId) return;
      setPosition(percentAt(event.clientX) - grabOffset);
    });

    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);
    frame.addEventListener('lostpointercapture', endDrag);

    handle.addEventListener('keydown', function (event) {
      var step = event.shiftKey ? LARGE_STEP : SMALL_STEP;
      var next;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = position - step;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = position + step;
          break;
        case 'PageDown':
          next = position - LARGE_STEP;
          break;
        case 'PageUp':
          next = position + LARGE_STEP;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 100;
          break;
        default:
          return;
      }

      event.preventDefault();
      setPosition(next);
    });

    setPosition(position);
  }

  function initAll(root) {
    var frames = (root || document).querySelectorAll('[data-skin-compare]');
    for (var i = 0; i < frames.length; i++) init(frames[i]);
  }

  initAll();

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
