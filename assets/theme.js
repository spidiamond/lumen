/*
  Scroll progress for the homepage wordmark.

  0 = large light logo, centered in the hero, transparent navbar
  1 = small dark logo, centered on the navbar slot, solid navbar

  Distance and chrome timing come from CSS variables on :root:
  --logo-transition-distance and --logo-chrome-start.
  Scale is not a separate constant. It is navbar width / hero width,
  measured from the live logo slot and the flight box.
*/
(function () {
  var header = document.querySelector('[data-site-header]');
  var hero = document.querySelector('[data-home-hero]');
  var flight = document.querySelector('[data-logo-flight]');
  var slot = document.querySelector('[data-logo-slot]');
  var lightLogo = document.querySelector('[data-logo-light]');
  var darkLogo = document.querySelector('[data-logo-dark]');
  var caption = document.querySelector('[data-hero-caption]');
  var video = document.querySelector('[data-hero-video]');

  if (!header || !hero || !flight || !slot || !lightLogo || !darkLogo) return;

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var geometry = null;
  var frame = 0;
  var scrolled = false;
  var videoOffscreen = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function easeInOutCubic(amount) {
    return amount < 0.5
      ? 4 * amount * amount * amount
      : 1 - Math.pow(-2 * amount + 2, 3) / 2;
  }

  function readNumber(name, fallback) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    var value = parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function measure() {
    var startWidth = flight.offsetWidth;
    var startHeight = flight.offsetHeight;
    var slotRect = slot.getBoundingClientRect();
    var heroRect = hero.getBoundingClientRect();
    var endWidth = slotRect.width;

    geometry = {
      startWidth: startWidth,
      startHeight: startHeight,
      startCenterX: heroRect.left + heroRect.width / 2,
      startCenterY: hero.offsetTop + hero.offsetHeight / 2,
      endCenterX: slotRect.left + slotRect.width / 2,
      endCenterY: slotRect.top + slotRect.height / 2,
      scale: startWidth > 0 && endWidth > 0 ? endWidth / startWidth : 1,
      distance: Math.max(hero.offsetHeight * readNumber('--logo-transition-distance', 0.72), 1),
      chromeStart: clamp(readNumber('--logo-chrome-start', 0.52), 0, 0.95)
    };
  }

  function progressFor(scrollY) {
    return clamp(scrollY / geometry.distance, 0, 1);
  }

  function place(progress) {
    var travel = easeInOutCubic(progress);
    var centerX = lerp(geometry.startCenterX, geometry.endCenterX, travel);
    var centerY = lerp(geometry.startCenterY, geometry.endCenterY, travel);
    var scale = lerp(1, geometry.scale, travel);
    var x = centerX - geometry.startWidth / 2;
    var y = centerY - geometry.startHeight / 2;

    flight.style.left = '0px';
    flight.style.top = '0px';
    flight.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
  }

  function paintChrome(progress) {
    var chromeSpan = Math.max(1 - geometry.chromeStart, 0.001);
    var chrome = easeInOutCubic(clamp((progress - geometry.chromeStart) / chromeSpan, 0, 1));

    header.style.setProperty('--header-progress', chrome.toFixed(4));
    lightLogo.style.opacity = String(1 - chrome);
    darkLogo.style.opacity = String(chrome);

    if (caption) {
      var captionFade = clamp(1 - progress / 0.34, 0, 1);
      caption.style.opacity = String(captionFade);
    }

    header.classList.toggle('header--hero', progress <= 0.001);
    header.classList.toggle('header--transition', progress > 0.001 && progress < 0.999);
    header.classList.toggle('header--scrolled', progress >= 0.999);

    var slotLogo = slot.querySelector('img');
    if (slotLogo) slotLogo.style.opacity = '0';
  }

  function syncVideo(scrollY) {
    if (!video) return;
    if (motionQuery.matches) {
      video.pause();
      video.autoplay = false;
      videoOffscreen = true;
      return;
    }
    var offscreen = hero.offsetTop + hero.offsetHeight - scrollY < 0;
    if (offscreen === videoOffscreen) return;
    videoOffscreen = offscreen;
    if (offscreen) {
      video.pause();
      return;
    }
    var playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') playAttempt.catch(function () {});
  }

  function update(scrollY) {
    if (!geometry) return;
    var progress = progressFor(scrollY);
    place(progress);
    paintChrome(progress);
    syncVideo(scrollY);
  }

  function applyReduced(scrollY) {
    if (video) {
      video.pause();
      video.autoplay = false;
    }
    var nextScrolled = scrollY > 24;
    if (nextScrolled === scrolled && flight.style.transform) return;
    scrolled = nextScrolled;

    if (scrolled) {
      flight.style.opacity = '0';
      header.style.setProperty('--header-progress', '1');
      if (caption) caption.style.opacity = '0';
      var slotLogo = slot.querySelector('img');
      if (slotLogo) slotLogo.style.opacity = '1';
      header.classList.add('header--scrolled');
      header.classList.remove('header--hero', 'header--transition');
    } else {
      flight.style.opacity = '1';
      lightLogo.style.opacity = '1';
      darkLogo.style.opacity = '0';
      header.style.setProperty('--header-progress', '0');
      if (caption) caption.style.opacity = '1';
      var restingLogo = slot.querySelector('img');
      if (restingLogo) restingLogo.style.opacity = '0';
      measure();
      place(0);
      header.classList.add('header--hero');
      header.classList.remove('header--scrolled', 'header--transition');
    }
  }

  function onScroll() {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      if (motionQuery.matches) applyReduced(window.scrollY);
      else update(window.scrollY);
    });
  }

  function onResize() {
    measure();
    if (motionQuery.matches) applyReduced(window.scrollY);
    else update(window.scrollY);
  }

  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('error', function () {
      hero.classList.add('home-hero--fallback');
    });
    if (motionQuery.matches) {
      video.pause();
      video.autoplay = false;
    } else {
      var firstPlay = video.play();
      if (firstPlay && typeof firstPlay.catch === 'function') firstPlay.catch(function () {});
    }
  } else {
    hero.classList.add('home-hero--fallback');
  }

  measure();
  if (motionQuery.matches) applyReduced(window.scrollY);
  else update(window.scrollY);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  if (typeof ResizeObserver === 'function') {
    var observer = new ResizeObserver(onResize);
    observer.observe(hero);
    observer.observe(header);
  }

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', onResize);
  } else if (typeof motionQuery.addListener === 'function') {
    motionQuery.addListener(onResize);
  }
})();
