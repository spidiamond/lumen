/*
  Product page: gallery, lightbox, variants, cart, and reveals.
  The product form still posts to Shopify if this script does not run.
*/
(function () {
  if (window.LumenProductPage) return;
  window.LumenProductPage = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileQuery = window.matchMedia('(max-width: 999px)');

  function cartRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function stampItems(root) {
    root.querySelectorAll('[data-pp-item]').forEach(function (item, index) {
      item.style.transitionDelay = (index * 90) + 'ms';
    });
  }

  var revealIO = null;
  if ('IntersectionObserver' in window) {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  }

  function bindReveal(scope) {
    scope.querySelectorAll('[data-pp-reveal]').forEach(function (el) {
      if (el.getAttribute('data-pp-bound') === 'true') return;
      el.setAttribute('data-pp-bound', 'true');
      stampItems(el);
      if (!document.documentElement.classList.contains('pp-motion') || !revealIO) {
        el.classList.add('is-in');
        return;
      }
      revealIO.observe(el);
    });
  }

  function bindRelated(scope) {
    scope.querySelectorAll('[data-pp-related]').forEach(function (section) {
      if (section.getAttribute('data-pp-related-bound') === 'true') return;
      section.setAttribute('data-pp-related-bound', 'true');
      var url = section.getAttribute('data-url');
      if (!url || !window.fetch) return;
      fetch(url)
        .then(function (response) { return response.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var next = doc.querySelector('[data-pp-related-grid]');
          var current = section.querySelector('[data-pp-related-grid]');
          if (!next || !current || !next.querySelector('.product-card')) return;
          current.replaceWith(next);
          stampItems(section);
        })
        .catch(function () {});
    });
  }

  function setAddState(root, state, message) {
    root.querySelectorAll('[data-pp-add]').forEach(function (button) {
      if (state) button.setAttribute('data-state', state);
      else button.removeAttribute('data-state');
      var stateLabel = button.querySelector('[data-pp-add-state]');
      if (stateLabel && message) stateLabel.textContent = message;
      if (state === 'loading') button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    });
    var status = root.querySelector('[data-pp-status]');
    if (status) status.textContent = message || '';
  }

  function bindProduct(root) {
    if (root.getAttribute('data-pp-ready') === 'true') return;
    root.setAttribute('data-pp-ready', 'true');

    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-pp-slide]'));
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-pp-thumb]'));
    var scroller = root.querySelector('[data-pp-scroller]');
    var count = root.querySelector('[data-pp-count]');
    var dialog = root.querySelector('[data-pp-viewer]');
    var viewerImg = root.querySelector('[data-pp-viewer-img]');
    var viewerCaption = root.querySelector('[data-pp-viewer-caption]');
    var active = 0;
    var scrollLock = false;

    function paintViewer() {
      if (!dialog || !slides.length) return;
      var slide = slides[active];
      if (viewerImg) {
        viewerImg.src = slide.getAttribute('data-full') || '';
        viewerImg.alt = slide.getAttribute('data-alt') || '';
      }
      if (viewerCaption) viewerCaption.textContent = (active + 1) + ' / ' + slides.length;
    }

    function setActive(index, fromScroll) {
      if (!slides.length) return;
      active = (index + slides.length) % slides.length;
      slides.forEach(function (slide, slideIndex) {
        var on = slideIndex === active;
        slide.classList.toggle('is-active', on);
        if (mobileQuery.matches) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      thumbs.forEach(function (thumb, thumbIndex) {
        if (thumbIndex === active) thumb.setAttribute('aria-current', 'true');
        else thumb.removeAttribute('aria-current');
      });
      if (count) count.textContent = String(active + 1);
      if (!fromScroll && scroller && scroller.scrollWidth > scroller.clientWidth + 8) {
        scrollLock = true;
        scroller.scrollTo({
          left: slides[active].offsetLeft,
          behavior: reduce ? 'auto' : 'smooth'
        });
        window.setTimeout(function () { scrollLock = false; }, reduce ? 40 : 480);
      }
      if (dialog && dialog.open) paintViewer();
    }

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        setActive(Number(thumb.getAttribute('data-index')) || 0, false);
      });
    });

    if (scroller) {
      var startX = null;
      scroller.addEventListener('pointerdown', function (event) {
        if (event.target.closest('a, button')) return;
        startX = event.clientX;
      });
      scroller.addEventListener('pointerup', function (event) {
        if (startX == null) return;
        var moved = Math.abs(event.clientX - startX);
        startX = null;
        if (moved > 10) return;
        if (event.target.closest('a, button')) return;
        openViewer();
      });
      scroller.addEventListener('pointercancel', function () { startX = null; });
      scroller.addEventListener('scroll', function () {
        if (scrollLock) return;
        if (scroller.scrollWidth <= scroller.clientWidth + 8) return;
        var width = scroller.clientWidth || 1;
        var index = Math.round(scroller.scrollLeft / width);
        if (index !== active) setActive(index, true);
      }, { passive: true });
      scroller.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActive(active + 1, false);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActive(active - 1, false);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openViewer();
        }
      });
    }

    function openViewer() {
      if (!dialog || !slides.length) return;
      paintViewer();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    root.querySelectorAll('[data-pp-open]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        openViewer();
      });
    });

    if (dialog) {
      var prev = dialog.querySelector('[data-pp-viewer-prev]');
      var next = dialog.querySelector('[data-pp-viewer-next]');
      var close = dialog.querySelector('[data-pp-viewer-close]');
      if (prev) prev.addEventListener('click', function () { setActive(active - 1, false); });
      if (next) next.addEventListener('click', function () { setActive(active + 1, false); });
      if (close) close.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActive(active + 1, false);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActive(active - 1, false);
        }
      });
    }

    var qty = root.querySelector('[data-pp-qty]');
    var minus = root.querySelector('[data-pp-minus]');
    var plus = root.querySelector('[data-pp-plus]');

    function setQty(next) {
      if (!qty) return;
      var min = parseInt(qty.getAttribute('min'), 10) || 1;
      var maxAttr = qty.getAttribute('max');
      var max = maxAttr ? parseInt(maxAttr, 10) : 0;
      var value = parseInt(next, 10);
      if (!value || value < min) value = min;
      if (max && value > max) value = max;
      qty.value = String(value);
    }

    if (qty && minus && plus) {
      minus.addEventListener('click', function () { setQty(parseInt(qty.value, 10) - 1); });
      plus.addEventListener('click', function () { setQty(parseInt(qty.value, 10) + 1); });
      qty.addEventListener('change', function () { setQty(qty.value); });
    }

    var data = root.querySelector('[data-pp-variants]');
    var variants = [];
    if (data) {
      try { variants = JSON.parse(data.textContent); } catch (error) { variants = []; }
    }

    var idInput = root.querySelector('[data-pp-variant]');
    var currentPrice = root.querySelector('[data-pp-current]');
    var compare = root.querySelector('[data-pp-compare]');
    var stock = root.querySelector('[data-pp-stock]');
    var stockLabel = root.querySelector('[data-pp-stock-label]');
    var barPrice = root.querySelector('[data-pp-bar-price]');

    function selectedOptions() {
      var options = [];
      root.querySelectorAll('[data-option-position]').forEach(function (field) {
        var position = Number(field.getAttribute('data-option-position'));
        var value = '';
        if (field.matches('select')) value = field.value;
        if (field.matches('input') && field.checked) value = field.value;
        if (value) options[position - 1] = value;
      });
      return options;
    }

    function matchVariant() {
      var chosen = selectedOptions();
      if (!chosen.length) return variants[0];
      return variants.find(function (variant) {
        return chosen.every(function (value, index) {
          return variant.options[index] === value;
        });
      }) || variants[0];
    }

    function renderVariant(variant) {
      if (!variant || !idInput) return;
      idInput.value = variant.id;
      function showMoney(node, cents, fallback) {
        if (!node) return;
        if (cents != null && window.LumenCurrency) {
          node.setAttribute('data-shop-cents', String(cents));
          node.textContent = window.LumenCurrency.format(cents);
          return;
        }
        node.removeAttribute('data-shop-cents');
        node.textContent = fallback || '';
      }
      showMoney(currentPrice, variant.price_cents, variant.price);
      showMoney(barPrice, variant.price_cents, variant.price);
      if (compare) {
        showMoney(compare, variant.compare_cents, variant.compare);
        compare.hidden = !variant.compare;
      }
      if (stock) stock.setAttribute('data-state', variant.available ? 'ready' : 'sold');
      if (stockLabel) stockLabel.textContent = variant.available ? 'In stock' : 'Sold out';
      root.querySelectorAll('[data-pp-add]').forEach(function (button) {
        button.disabled = !variant.available;
        button.removeAttribute('data-state');
        var label = button.querySelector('[data-pp-add-label]');
        if (label) label.textContent = variant.available ? 'Add to cart' : 'Sold out';
      });
      if (qty) {
        var min = variant.min || 1;
        qty.min = String(min);
        qty.setAttribute('min', String(min));
        if (variant.max) {
          qty.max = String(variant.max);
          qty.setAttribute('max', String(variant.max));
        } else {
          qty.removeAttribute('max');
        }
        setQty(qty.value);
      }
      if (variant.image_id) {
        slides.forEach(function (slide, index) {
          if (String(slide.getAttribute('data-image-id')) === String(variant.image_id)) setActive(index, false);
        });
      }
    }

    root.querySelectorAll('[data-option-position]').forEach(function (field) {
      field.addEventListener('change', function () { renderVariant(matchVariant()); });
    });

    var form = root.querySelector('[data-product-form]');
    if (form) {
      form.addEventListener('submit', function (event) {
        var submitter = event.submitter;
        if (!submitter || !submitter.hasAttribute('data-pp-add')) return;
        var button = submitter;
        if (button.disabled || button.getAttribute('data-state') === 'loading') {
          event.preventDefault();
          return;
        }
        if (!window.fetch) return;
        event.preventDefault();
        setAddState(root, 'loading', 'Adding');

        fetch(cartRoot() + 'cart/add.js', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        })
          .then(function (response) {
            return response.json().then(function (body) {
              return { ok: response.ok, body: body };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              setAddState(root, '', '');
              var status = root.querySelector('[data-pp-status]');
              if (status) status.textContent = (result.body && (result.body.description || result.body.message)) || 'Could not add to cart.';
              return;
            }
            setAddState(root, 'added', 'Added');
            fetch(cartRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
              .then(function (response) { return response.json(); })
              .then(function (cart) {
                document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart, item: result.body } }));
              })
              .catch(function () {});
            window.setTimeout(function () { setAddState(root, '', ''); }, 1600);
          })
          .catch(function () {
            setAddState(root, '', '');
            form.submit();
          });
      });
    }

    var anchor = root.querySelector('[data-purchase-anchor]');
    var bar = root.querySelector('[data-pp-bar]');
    if (anchor && bar && 'IntersectionObserver' in window) {
      function updateBar() {
        var rect = anchor.getBoundingClientRect();
        var show = mobileQuery.matches && rect.bottom < 8;
        bar.classList.toggle('is-visible', show);
        bar.inert = !show;
        bar.setAttribute('aria-hidden', show ? 'false' : 'true');
        document.documentElement.classList.toggle('pp-bar-open', show);
      }
      var barIO = new IntersectionObserver(updateBar, { threshold: 0 });
      barIO.observe(anchor);
      root.__ppUpdateBar = updateBar;
      updateBar();
      if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', updateBar);
      if (!window.__ppBarScroll) {
        window.__ppBarScroll = true;
        var scheduled = false;
        window.addEventListener('scroll', function () {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(function () {
            scheduled = false;
            document.querySelectorAll('[data-product-page]').forEach(function (page) {
              if (typeof page.__ppUpdateBar === 'function') page.__ppUpdateBar();
            });
          });
        }, { passive: true });
      }
    }
  }

  function boot(event) {
    var scope = document;
    if (event && event.target && event.target.querySelectorAll) scope = event.target;
    bindReveal(scope);
    bindRelated(scope);
    scope.querySelectorAll('[data-product-page]').forEach(bindProduct);
  }

  boot();
  document.addEventListener('shopify:section:load', boot);
})();
