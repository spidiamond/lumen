/*
  Navbar and footer share one currency list.
  Shopify Markets on this store present every country in the shop currency,
  and the preview rejects the localization post, so the choice is applied here
  and prices are shown in that currency.
*/
(function () {
  var config = window.LumenCurrencyConfig || {};
  var codes = config.codes || ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'INR'];
  var shop = config.shop || 'USD';
  var rates = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AUD: 1.53,
    CAD: 1.36,
    JPY: 149,
    INR: 84
  };

  function readCookie() {
    var match = document.cookie.match(/(?:^|; )lumen_currency=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function active() {
    var saved = readCookie();
    if (codes.indexOf(saved) !== -1) return saved;
    if (codes.indexOf(shop) !== -1) return shop;
    return codes[0];
  }

  function format(cents) {
    var code = active();
    var shopRate = rates[shop] || 1;
    var nextRate = rates[code] || 1;
    var amount = ((Number(cents) || 0) / 100) / shopRate * nextRate;
    var digits = code === 'JPY' ? 0 : 2;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(amount);
    } catch (error) {
      return amount.toFixed(digits);
    }
  }

  function paint() {
    document.querySelectorAll('[data-shop-cents]').forEach(function (node) {
      node.textContent = format(node.getAttribute('data-shop-cents'));
    });
  }

  function copyFlag(code) {
    var source = document.querySelector('[data-currency-code="' + code + '"] .site-header__flag');
    if (!source) return;
    document.querySelectorAll('[data-currency-flag]').forEach(function (slot) {
      slot.replaceChildren(source.cloneNode(true));
    });
  }

  function closeMenu() {
    var menu = document.querySelector('[data-currency-menu]');
    var toggle = document.querySelector('[data-currency-toggle]');
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function reflect(code) {
    var label = document.querySelector('.site-header__currency-label');
    var toggle = document.querySelector('[data-currency-toggle]');
    if (label) label.textContent = code;
    if (toggle) toggle.setAttribute('aria-label', 'Currency, ' + code);
    document.querySelectorAll('[data-currency-code]').forEach(function (button) {
      button.setAttribute('aria-selected', button.getAttribute('data-currency-code') === code ? 'true' : 'false');
    });
    var select = document.querySelector('[data-footer-country]');
    if (select && select.value !== code) select.value = code;
    copyFlag(code);
  }

  function set(code) {
    if (codes.indexOf(code) === -1 || code === active()) {
      closeMenu();
      return;
    }
    document.cookie = 'lumen_currency=' + encodeURIComponent(code) + ';path=/;max-age=31536000;SameSite=Lax';
    reflect(code);
    paint();
    closeMenu();
    document.dispatchEvent(new CustomEvent('lumen:currency', { detail: { currency: code } }));
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-currency-code]');
    if (!button) return;
    event.preventDefault();
    set(button.getAttribute('data-currency-code'));
  });

  var select = document.querySelector('[data-footer-country]');
  if (select) {
    select.addEventListener('change', function () {
      set(select.value);
    });
  }

  reflect(active());
  paint();

  window.LumenCurrency = {
    format: format,
    active: active,
    set: set
  };
})();
