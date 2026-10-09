/*
  Browser-local wishlist. Stored in localStorage for this browser only.
  It is not synced across devices or Shopify customer accounts.
*/
(function () {
  if (window.LumenWishlist) return;

  var KEY = 'lumen_wishlist';
  var root = document.querySelector('[data-cart-root]');
  var linesEl = root && root.querySelector('[data-wish-lines]');
  var emptyEl = root && root.querySelector('[data-wish-empty]');
  var cartView = root && root.querySelector('[data-drawer-cart]');
  var wishView = root && root.querySelector('[data-drawer-wish]');
  var renderToken = 0;

  function shopRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function read() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && item.handle && item.id;
      });
    } catch (error) {
      return [];
    }
  }

  function itemLabel(count) {
    return count === 1 ? '1 item' : count + ' items';
  }

  function paintCount() {
    var el = root && root.querySelector('[data-wish-count]');
    if (el) el.textContent = itemLabel(read().length);
  }

  function showCounts(cartOn) {
    var cartCount = root && root.querySelector('[data-cart-count]');
    var wishCount = root && root.querySelector('[data-wish-count]');
    if (cartCount) cartCount.hidden = !cartOn;
    if (wishCount) wishCount.hidden = cartOn;
  }

  function write(items) {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    paintCount();
    document.dispatchEvent(new CustomEvent('lumen:wishlist'));
  }

  function has(id) {
    return read().some(function (item) { return String(item.id) === String(id); });
  }

  function money(cents) {
    if (window.LumenCurrency) return window.LumenCurrency.format(cents);
    return ((Number(cents) || 0) / 100).toFixed(2);
  }

  function paintHearts() {
    document.querySelectorAll('[data-wishlist-toggle]').forEach(function (button) {
      var on = has(button.getAttribute('data-product-id'));
      var name = button.getAttribute('data-product-title') || 'this product';
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + name + (on ? ' from wishlist' : ' to wishlist'));
    });
  }

  function toggle(button) {
    var id = button.getAttribute('data-product-id');
    var handle = button.getAttribute('data-product-handle');
    var variantId = button.getAttribute('data-variant-id');
    if (!id || !handle) return;
    var items = read();
    var index = -1;
    items.forEach(function (item, i) {
      if (String(item.id) === String(id)) index = i;
    });
    if (index >= 0) items.splice(index, 1);
    else items.push({ id: Number(id), handle: handle, variantId: variantId ? Number(variantId) : null });
    write(items);
    if (wishView && !wishView.hidden) render();
  }

  function removeId(id) {
    write(read().filter(function (item) { return String(item.id) !== String(id); }));
    render();
  }

  function showTab(name) {
    if (!cartView || !wishView) return;
    var cartOn = name !== 'wish';
    cartView.hidden = !cartOn;
    wishView.hidden = cartOn;
    root.querySelectorAll('[data-drawer-tab]').forEach(function (tab) {
      var on = tab.getAttribute('data-drawer-tab') === (cartOn ? 'cart' : 'wish');
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    showCounts(cartOn);
    if (!cartOn) render();
  }

  function productUrl(handle) {
    return shopRoot() + 'products/' + handle + '.js';
  }

  function render() {
    if (!linesEl) return;
    var mine = ++renderToken;
    var items = read();
    paintCount();
    if (!items.length) {
      linesEl.hidden = true;
      linesEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    Promise.all(items.map(function (item) {
      return fetch(productUrl(item.handle), { headers: { Accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) return null;
          return response.json().then(function (product) {
            product._savedVariant = item.variantId;
            return product;
          });
        })
        .catch(function () { return null; });
    })).then(function (products) {
      if (mine !== renderToken) return;
      var live = [];
      var kept = [];
      products.forEach(function (product, index) {
        if (!product) return;
        live.push(product);
        kept.push(items[index]);
      });
      if (kept.length !== items.length) write(kept);
      else paintCount();
      if (emptyEl) emptyEl.hidden = live.length > 0;
      linesEl.hidden = live.length === 0;
      linesEl.innerHTML = '';
      live.forEach(function (product) { linesEl.appendChild(row(product)); });
    }).catch(function () {});
  }

  function row(product) {
    var li = document.createElement('li');
    li.className = 'cart-line';
    var variants = product.variants || [];
    var available = variants.filter(function (variant) { return variant.available; });
    var saved = variants.filter(function (variant) {
      return String(variant.id) === String(product._savedVariant);
    })[0];
    var chosen = (saved && saved.available) ? saved : (available[0] || variants[0]);
    var img = document.createElement('a');
    img.className = 'cart-line__media';
    img.href = product.url || (shopRoot() + 'products/' + product.handle);
    if (product.featured_image) {
      var image = document.createElement('img');
      image.alt = '';
      image.src = product.featured_image;
      img.appendChild(image);
    }
    var body = document.createElement('div');
    var title = document.createElement('p');
    title.className = 'cart-line__title';
    var link = document.createElement('a');
    link.href = img.href;
    link.textContent = product.title;
    title.appendChild(link);
    var price = document.createElement('p');
    price.className = 'cart-line__price';
    price.textContent = chosen ? money(chosen.price) : '';
    var stock = document.createElement('p');
    stock.className = 'cart-line__variant';
    stock.textContent = chosen && chosen.available ? 'In stock' : 'Sold out';
    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(stock);
    if (variants.length > 1) {
      var select = document.createElement('select');
      select.className = 'cart-wish__select';
      select.setAttribute('aria-label', 'Variant for ' + product.title);
      variants.forEach(function (variant) {
        var option = document.createElement('option');
        option.value = String(variant.id);
        option.textContent = variant.title + (variant.available ? '' : ' — Sold out');
        option.disabled = !variant.available;
        if (chosen && String(variant.id) === String(chosen.id)) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        var next = variants.filter(function (variant) { return String(variant.id) === select.value; })[0];
        if (!next) return;
        price.textContent = money(next.price);
        stock.textContent = next.available ? 'In stock' : 'Sold out';
        add.disabled = !next.available;
        add.textContent = next.available ? 'Add to cart' : 'Sold out';
      });
      body.appendChild(select);
    }
    var controls = document.createElement('div');
    controls.className = 'cart-line__controls';
    var add = document.createElement('button');
    add.className = 'cart-wish__add';
    add.type = 'button';
    add.textContent = chosen && chosen.available ? 'Add to cart' : 'Sold out';
    add.disabled = !(chosen && chosen.available);
    add.addEventListener('click', function () {
      var variantId = chosen && chosen.id;
      var select = body.querySelector('select');
      if (select) variantId = Number(select.value);
      var variant = variants.filter(function (item) { return String(item.id) === String(variantId); })[0];
      if (!variant || !variant.available || add.disabled) return;
      add.disabled = true;
      add.textContent = 'Adding';
      fetch(shopRoot() + 'cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variant.id, quantity: 1 })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error((data && (data.description || data.message)) || 'Could not add to cart.');
          return data;
        });
      }).then(function (item) {
        return fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.json(); })
          .then(function (cart) {
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart, item: item } }));
            add.disabled = false;
            add.textContent = 'Add to cart';
          });
      }).catch(function () {
        add.disabled = false;
        add.textContent = 'Add to cart';
      });
    });
    var remove = document.createElement('button');
    remove.className = 'cart-line__remove';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', function () { removeId(product.id); });
    controls.appendChild(add);
    controls.appendChild(remove);
    body.appendChild(controls);
    li.appendChild(img);
    li.appendChild(body);
    return li;
  }

  document.addEventListener('click', function (event) {
    var heart = event.target.closest('[data-wishlist-toggle]');
    if (heart) {
      event.preventDefault();
      event.stopPropagation();
      toggle(heart);
      return;
    }
    var tab = event.target.closest('[data-drawer-tab]');
    if (tab) {
      showTab(tab.getAttribute('data-drawer-tab'));
    }
  });

  document.addEventListener('lumen:wishlist', paintHearts);
  document.addEventListener('lumen:drawer-open', function () { showTab('cart'); });

  if (root) {
    var shop = root.querySelector('[data-wish-shop]');
    if (shop) {
      shop.addEventListener('click', function () {
        var close = root.querySelector('[data-cart-close]');
        if (close) close.click();
      });
    }
  }

  window.LumenWishlist = { read: read, has: has, toggle: toggle };
  paintHearts();
  paintCount();
  showCounts(true);
})();
