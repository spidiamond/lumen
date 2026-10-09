/*
  Cart confirmation and drawer.
  Listens for the cart:updated event already sent by product cards and the product page.
  Without this script, the cart icon still opens the cart page.
*/
(function () {
  if (window.LumenCart) return;
  window.LumenCart = true;

  var root = document.querySelector('[data-cart-root]');
  if (!root) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var currency = root.getAttribute('data-cart-currency') || 'USD';
  var shipThreshold = Number(root.getAttribute('data-ship')) || 0;
  var dialog = root.querySelector('[data-cart-drawer]');
  var panel = root.querySelector('.cart-drawer__panel');
  var linesEl = root.querySelector('[data-cart-lines]');
  var emptyEl = root.querySelector('[data-cart-empty]');
  var summaryEl = root.querySelector('[data-cart-summary]');
  var noteWrap = root.querySelector('[data-cart-note-wrap]');
  var noteToggle = root.querySelector('[data-cart-note-toggle]');
  var noteField = root.querySelector('[data-cart-note]');
  var upsellEl = root.querySelector('[data-cart-upsell]');
  var shipEl = root.querySelector('[data-cart-ship]');
  var toast = root.querySelector('[data-cart-toast]');
  var statusEl = root.querySelector('[data-cart-status]');
  var checkoutForm = root.querySelector('[data-cart-checkout]');

  var cartState = null;
  var toastTimer = null;
  var toastToken = 0;
  var noteTimer = null;
  var noteDirty = false;
  var lastSource = null;
  var closing = false;

  function afterPaint(fn) {
    var ran = false;
    function run() {
      if (ran) return;
      ran = true;
      fn();
    }
    requestAnimationFrame(function () { requestAnimationFrame(run); });
    window.setTimeout(run, 40);
  }

  function shopRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function money(cents) {
    if (window.LumenCurrency) return window.LumenCurrency.format(cents);
    var amount = (Number(cents) || 0) / 100;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      return amount.toFixed(2);
    }
  }

  function imageSrc(image) {
    if (!image) return '';
    if (typeof image === 'string') return image;
    return image.src || '';
  }

  function announce(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function itemLabel(count) {
    return count === 1 ? '1 item' : count + ' items';
  }

  function request(path, body) {
    return fetch(shopRoot() + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var message = (data && (data.description || data.message)) || 'Could not update the cart.';
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function loadCart() {
    return request('cart.js').then(function (cart) {
      cartState = cart;
      return cart;
    });
  }

  function showError(message) {
    var error = root.querySelector('[data-cart-error]');
    if (!error) return;
    if (!message) {
      error.hidden = true;
      error.textContent = '';
      return;
    }
    error.hidden = false;
    error.textContent = message;
  }

  function setShip(cart) {
    if (!shipEl) return;
    if (!shipThreshold || !cart || !cart.item_count) {
      shipEl.hidden = true;
      return;
    }
    shipEl.hidden = false;
    var total = cart.total_price || 0;
    var ratio = Math.max(0, Math.min(1, total / shipThreshold));
    var bar = root.querySelector('[data-cart-meter]');
    var copy = root.querySelector('[data-cart-ship-copy]');
    if (bar) bar.style.width = (ratio * 100) + '%';
    if (copy) {
      if (ratio >= 1) copy.textContent = 'Complimentary shipping unlocked';
      else copy.textContent = 'You\u2019re ' + money(shipThreshold - total) + ' away from complimentary shipping';
    }
  }

  function setNoteOpen(open) {
    if (!noteWrap || !noteToggle) return;
    noteWrap.classList.toggle('is-open', open);
    noteToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = noteWrap.querySelector('.cart-note__panel');
    if (panel) panel.inert = !open;
  }

  function renderLines(cart) {
    linesEl.replaceChildren();
    cart.items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'cart-line';

      var media = document.createElement('a');
      media.className = 'cart-line__media';
      media.href = item.url;
      if (imageSrc(item.image)) {
        var img = document.createElement('img');
        img.src = imageSrc(item.image);
        img.alt = '';
        img.width = 160;
        img.height = 160;
        media.appendChild(img);
      }
      li.appendChild(media);

      var info = document.createElement('div');
      var title = document.createElement('p');
      title.className = 'cart-line__title';
      var titleLink = document.createElement('a');
      titleLink.href = item.url;
      titleLink.textContent = item.product_title || item.title;
      title.appendChild(titleLink);
      info.appendChild(title);

      if (item.variant_title && item.variant_title !== 'Default Title') {
        var variant = document.createElement('p');
        variant.className = 'cart-line__variant';
        variant.textContent = item.variant_title;
        info.appendChild(variant);
      }

      var price = document.createElement('p');
      price.className = 'cart-line__price';
      price.textContent = money(item.final_line_price);
      info.appendChild(price);

      var controls = document.createElement('div');
      controls.className = 'cart-line__controls';

      var qty = document.createElement('div');
      qty.className = 'cart-qty';
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '\u2212';
      minus.setAttribute('aria-label', 'Decrease quantity');
      if (item.quantity <= 1) minus.disabled = true;
      else minus.addEventListener('click', function () { updateQty(item.key, item.quantity - 1); });
      var count = document.createElement('span');
      count.textContent = String(item.quantity);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'Increase quantity');
      plus.addEventListener('click', function () { updateQty(item.key, item.quantity + 1); });
      qty.appendChild(minus);
      qty.appendChild(count);
      qty.appendChild(plus);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cart-line__remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () { updateQty(item.key, 0); });

      controls.appendChild(qty);
      controls.appendChild(remove);
      info.appendChild(controls);
      li.appendChild(info);
      linesEl.appendChild(li);
    });
  }

  function render(cart) {
    var count = cart.item_count || 0;
    var countEl = root.querySelector('[data-cart-count]');
    var subtotal = root.querySelector('[data-cart-subtotal]');
    if (countEl) countEl.textContent = itemLabel(count);
    if (subtotal) {
      var next = money(cart.total_price);
      if (subtotal.textContent && subtotal.textContent !== next) {
        summaryEl.classList.remove('is-changed');
        void summaryEl.offsetWidth;
        summaryEl.classList.add('is-changed');
      }
      subtotal.textContent = next;
    }

    var hasItems = count > 0;
    emptyEl.hidden = hasItems;
    linesEl.hidden = !hasItems;
    summaryEl.hidden = !hasItems;
    noteWrap.hidden = !hasItems;
    if (!hasItems && upsellEl) upsellEl.hidden = true;
    if (hasItems) renderLines(cart);
    else linesEl.replaceChildren();

    if (noteField && document.activeElement !== noteField) {
      noteField.value = cart.note || '';
      if (cart.note) setNoteOpen(true);
    }
    setShip(cart);
    showError('');
    if (hasItems) loadUpsell(cart);
  }

  function recommend(productId, intent) {
    return fetch(shopRoot() + 'recommendations/products.json?product_id=' + productId + '&limit=8&intent=' + intent, {
      headers: { Accept: 'application/json' }
    })
      .then(function (response) { return response.json(); })
      .then(function (data) { return (data && data.products) || []; })
      .catch(function () { return []; });
  }

  function loadUpsell(cart) {
    if (!upsellEl || !cart.items.length) return;
    var productId = cart.items[cart.items.length - 1].product_id;
    var inCart = {};
    cart.items.forEach(function (item) { inCart[item.product_id] = true; });
    recommend(productId, 'complementary').then(function (products) {
      if (products.length) return products;
      return recommend(productId, 'related');
    }).then(function (products) {
        var pick = products.find(function (product) {
          return product && product.available && !inCart[product.id] && product.variants && product.variants[0];
        });
        upsellEl.replaceChildren();
        if (!pick) {
          upsellEl.hidden = true;
          return;
        }
        upsellEl.hidden = false;
        var kicker = document.createElement('p');
        kicker.className = 'cart-upsell__kicker';
        kicker.textContent = 'Complete your ritual';
        var img = document.createElement('img');
        img.alt = '';
        img.width = 64;
        img.height = 64;
        if (pick.featured_image) img.src = pick.featured_image;
        else if (pick.images && pick.images[0]) img.src = pick.images[0];
        var copy = document.createElement('div');
        var title = document.createElement('p');
        title.className = 'cart-upsell__title';
        title.textContent = pick.title;
        var price = document.createElement('p');
        price.className = 'cart-upsell__price';
        price.textContent = money(pick.price);
        copy.appendChild(title);
        copy.appendChild(price);
        var add = document.createElement('button');
        add.type = 'button';
        add.className = 'cart-upsell__add';
        add.textContent = '+ Add';
        add.addEventListener('click', function () {
          add.disabled = true;
          request('cart/add.js', { id: pick.variants[0].id, quantity: 1 })
            .then(function () { return loadCart(); })
            .then(function (next) {
              render(next);
              announce(pick.title + ' added to your ritual');
            })
            .catch(function (error) {
              add.disabled = false;
              showError(error.message);
            });
        });
        upsellEl.appendChild(kicker);
        upsellEl.appendChild(img);
        upsellEl.appendChild(copy);
        upsellEl.appendChild(add);
      })
      .catch(function () {
        upsellEl.hidden = true;
      });
  }

  function updateQty(key, quantity) {
    request('cart/change.js', { id: key, quantity: quantity })
      .then(function (cart) {
        cartState = cart;
        render(cart);
        announce(quantity === 0 ? 'Removed from cart' : 'Quantity updated');
      })
      .catch(function (error) {
        showError(error.message);
      });
  }

  function saveNote() {
    noteDirty = false;
    return request('cart/update.js', { note: noteField ? noteField.value : '' }).then(function (cart) {
      cartState = cart;
      return cart;
    });
  }

  function flyToCart(button) {
    if (reduce || !button) return;
    var icon = document.querySelector('[data-cart-toggle]');
    if (!icon) return;
    var scope = button.closest('[data-product-card], [data-product-page]');
    var source = scope && scope.querySelector('.product-card__image--primary, .pp-slide.is-active img, img');
    if (!source) return;
    var from = source.getBoundingClientRect();
    var to = icon.getBoundingClientRect();
    if (!from.width || !to.width) return;
    var ghost = document.createElement('img');
    ghost.className = 'cart-fly';
    ghost.alt = '';
    ghost.src = source.currentSrc || source.src;
    var size = Math.min(from.width, 96);
    ghost.style.left = from.left + 'px';
    ghost.style.top = from.top + 'px';
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    document.body.appendChild(ghost);
    var dx = (to.left + to.width / 2) - (from.left + size / 2);
    var dy = (to.top + to.height / 2) - (from.top + size / 2);
    void ghost.offsetWidth;
    afterPaint(function () {
      ghost.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0.18)';
      ghost.style.opacity = '0.15';
    });
    window.setTimeout(function () { ghost.remove(); }, 580);
  }

  function hideToast() {
    if (!toast || toast.hidden) return;
    var token = toastToken;
    toast.classList.remove('is-in');
    window.clearTimeout(toastTimer);
    window.setTimeout(function () {
      if (token !== toastToken) return;
      if (!toast.classList.contains('is-in')) toast.hidden = true;
    }, reduce ? 0 : 520);
  }

  function showToast(item) {
    if (!toast || !item || (dialog && dialog.open)) return;
    var img = toast.querySelector('[data-cart-toast-img]');
    var title = toast.querySelector('[data-cart-toast-title]');
    var price = toast.querySelector('[data-cart-toast-price]');
    var src = imageSrc(item.image);
    if (img) {
      img.hidden = !src;
      if (src) img.src = src;
    }
    if (title) title.textContent = item.product_title || item.title || '';
    if (price) price.textContent = money(item.final_price || item.price);
    var token = ++toastToken;
    toast.hidden = false;
    toast.classList.remove('is-in');
    void toast.offsetWidth;
    afterPaint(function () {
      if (token !== toastToken) return;
      toast.classList.add('is-in');
    });
    announce('Added to your ritual');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      if (token === toastToken) hideToast();
    }, 4000);
  }

  function openDrawer() {
    if (!dialog || dialog.open) return;
    hideToast();
    closing = false;
    document.dispatchEvent(new CustomEvent('lumen:drawer-open'));
    dialog.showModal();
    document.documentElement.classList.add('cart-open');
    var reveal = function () {
      dialog.classList.add('is-open', 'is-intro');
      var closeBtn = dialog.querySelector('.cart-drawer__close');
      if (closeBtn) closeBtn.focus();
      window.setTimeout(function () { dialog.classList.remove('is-intro'); }, 700);
    };
    if (reduce) reveal();
    else afterPaint(reveal);
    var ready = cartState ? Promise.resolve(cartState) : loadCart();
    ready.then(render).catch(function (error) { showError(error.message); });
  }

  function closeDrawer() {
    if (!dialog || !dialog.open || closing) return;
    closing = true;
    dialog.classList.remove('is-open');
    document.documentElement.classList.remove('cart-open');
    var finish = function () {
      if (dialog.open) dialog.close();
      closing = false;
    };
    if (reduce) finish();
    else window.setTimeout(finish, 520);
  }

  document.addEventListener('click', function (event) {
    var source = event.target.closest('[data-product-card-button], [data-pp-add], [data-product-card-form] button, [data-product-form] button');
    if (source) lastSource = source;
    var toggle = event.target.closest('[data-cart-toggle]');
    if (!toggle || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openDrawer();
  }, true);

  document.addEventListener('cart:updated', function (event) {
    var detail = event.detail || {};
    if (detail.cart) cartState = detail.cart;
    flyToCart(lastSource);
    if (dialog && dialog.open) {
      if (cartState) render(cartState);
      return;
    }
    showToast(detail.item || (cartState && cartState.items && cartState.items[cartState.items.length - 1]));
  });

  root.querySelectorAll('[data-cart-close]').forEach(function (button) {
    button.addEventListener('click', closeDrawer);
  });

  if (dialog) {
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeDrawer();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.classList.contains('cart-drawer__backdrop')) closeDrawer();
    });
  }

  var view = root.querySelector('[data-cart-toast-view]');
  var dismiss = root.querySelector('[data-cart-toast-dismiss]');
  if (view) {
    view.addEventListener('click', function () {
      hideToast();
      openDrawer();
    });
  }
  if (dismiss) dismiss.addEventListener('click', hideToast);

  if (noteToggle) {
    noteToggle.addEventListener('click', function () {
      setNoteOpen(noteToggle.getAttribute('aria-expanded') !== 'true');
    });
    setNoteOpen(false);
  }
  if (noteField) {
    noteField.addEventListener('input', function () {
      noteDirty = true;
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(function () {
        saveNote().catch(function (error) { showError(error.message); });
      }, 500);
    });
  }
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function (event) {
      if (!noteDirty) return;
      event.preventDefault();
      saveNote().then(function () {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'checkout';
        input.value = 'Checkout';
        checkoutForm.appendChild(input);
        checkoutForm.submit();
      }).catch(function (error) {
        showError(error.message);
      });
    });
  }

  document.addEventListener('lumen:currency', function () {
    if (cartState) render(cartState);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (dialog && dialog.open) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    hideToast();
  });
})();
