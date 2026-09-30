/*
  Product card add-to-cart through Shopify's AJAX Cart API.
  Without JavaScript, or if the request fails to send, the form posts to
  /cart/add normally, so buying always works.

  After a successful add, a `cart:updated` event is dispatched on document
  with the new cart, so a future cart drawer or count badge can listen for it.
*/
(function () {
  if (window.LumenProductCards) return;
  window.LumenProductCards = true;

  var ADDED_DURATION = 1800;

  function cartRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function announce(form, message) {
    var status = form.querySelector('[data-product-card-status]');
    if (status) status.textContent = message;
  }

  function restore(button, label) {
    button.removeAttribute('data-state');
    button.disabled = false;
    if (label) button.setAttribute('aria-label', label);
  }

  function handleSubmit(event) {
    var form = event.target.closest('[data-product-card-form]');
    if (!form) return;

    var button = form.querySelector('[data-product-card-button]');
    if (!button || button.disabled || button.getAttribute('data-state') === 'loading') {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    var label = button.getAttribute('aria-label');
    button.setAttribute('data-state', 'loading');
    button.setAttribute('aria-busy', 'true');

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
        button.removeAttribute('aria-busy');

        if (!result.ok) {
          restore(button, label);
          announce(form, (result.body && (result.body.description || result.body.message)) || 'Could not add to cart.');
          return;
        }

        button.setAttribute('data-state', 'added');
        button.setAttribute('aria-label', 'Added to cart');
        announce(form, 'Added to cart');

        fetch(cartRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.json(); })
          .then(function (cart) {
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart, item: result.body } }));
          })
          .catch(function () {});

        window.setTimeout(function () {
          restore(button, label);
          announce(form, '');
        }, ADDED_DURATION);
      })
      .catch(function () {
        button.removeAttribute('aria-busy');
        restore(button, label);
        form.submit();
      });
  }

  document.addEventListener('submit', handleSubmit);
})();
