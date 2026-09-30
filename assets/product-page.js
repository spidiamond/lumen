/*
  Product page: gallery, quantity, read more, and variant matching.
  The form still posts to Shopify if this script does not run.
*/
(function () {
  if (window.LumenProductPage) return;
  window.LumenProductPage = true;

  function init(root) {
    var photo = root.querySelector('img.product-page__photo');
    var thumbs = root.querySelectorAll('[data-product-thumb]');

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (!photo) return;
        photo.src = thumb.getAttribute('data-full');
        photo.srcset = thumb.getAttribute('data-srcset') || '';
        photo.alt = thumb.getAttribute('data-alt') || '';
        thumbs.forEach(function (item) {
          item.removeAttribute('aria-current');
        });
        thumb.setAttribute('aria-current', 'true');
      });
    });

    var copy = root.querySelector('[data-product-copy]');
    var more = root.querySelector('[data-product-more]');
    if (copy && more) {
      function updateMore() {
        if (copy.classList.contains('is-open')) return;
        more.hidden = copy.scrollHeight <= copy.clientHeight + 2;
      }
      updateMore();
      requestAnimationFrame(updateMore);
      more.addEventListener('click', function () {
        var open = copy.classList.toggle('is-open');
        more.textContent = open ? 'Read less' : 'Read more';
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    var qty = root.querySelector('.product-page__qty-input');
    var minus = root.querySelector('[data-qty-minus]');
    var plus = root.querySelector('[data-qty-plus]');

    function setQty(next) {
      var value = parseInt(next, 10);
      if (!value || value < 1) value = 1;
      qty.value = String(value);
    }

    if (qty && minus && plus) {
      minus.addEventListener('click', function () {
        setQty(parseInt(qty.value, 10) - 1);
      });
      plus.addEventListener('click', function () {
        setQty(parseInt(qty.value, 10) + 1);
      });
      qty.addEventListener('change', function () {
        setQty(qty.value);
      });
    }

    var data = root.querySelector('[data-product-variants]');
    if (!data) return;
    var variants = [];
    try {
      variants = JSON.parse(data.textContent);
    } catch (error) {
      return;
    }
    if (!variants.length) return;

    var idInput = root.querySelector('[data-variant-id]');
    var current = root.querySelector('[data-product-current]');
    var compare = root.querySelector('[data-product-compare]');
    var stock = root.querySelector('[data-product-stock]');
    var stockLabel = root.querySelector('[data-product-stock-label]');
    var add = root.querySelector('[data-product-add]');
    var addLabel = root.querySelector('[data-product-add-label]');
    var addPrice = root.querySelector('[data-product-add-price]');

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
      var found = variants.find(function (variant) {
        return chosen.every(function (value, index) {
          return variant.options[index] === value;
        });
      });
      return found || variants[0];
    }

    function render(variant) {
      if (!variant || !idInput) return;
      idInput.value = variant.id;
      if (current) current.textContent = variant.price;
      if (compare) {
        compare.textContent = variant.compare || '';
        compare.hidden = !variant.compare;
      }
      if (current) current.classList.toggle('product-page__sale', Boolean(variant.compare));
      if (stock) stock.setAttribute('data-state', variant.available ? 'ready' : 'sold');
      if (stockLabel) stockLabel.textContent = variant.available ? 'In stock' : 'Sold out';
      if (add) add.disabled = !variant.available;
      if (addLabel) addLabel.textContent = variant.available ? 'Add to cart' : 'Sold out';
      if (addPrice) {
        addPrice.hidden = !variant.available;
        addPrice.textContent = '– ' + variant.price;
      }
    }

    root.querySelectorAll('[data-option-position]').forEach(function (field) {
      field.addEventListener('change', function () {
        render(matchVariant());
      });
    });
  }

  function boot() {
    document.querySelectorAll('[data-product-page]').forEach(function (root) {
      if (root.getAttribute('data-product-ready') === 'true') return;
      root.setAttribute('data-product-ready', 'true');
      init(root);
    });
  }

  boot();
  document.addEventListener('shopify:section:load', boot);
})();
