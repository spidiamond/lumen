/*
  Contact page motion and the FAQ accordion.
  It does not replace native scrolling or the Shopify contact form.
*/
(function () {
  if (window.LumenContact) return;
  window.LumenContact = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function markIn(el) {
    el.classList.add('is-in');
    el.querySelectorAll('[data-contact-line], [data-contact-item]').forEach(function (line, index) {
      line.style.transitionDelay = (index * 110) + 'ms';
      line.classList.add('is-in');
    });
  }

  var revealIO = null;
  if ('IntersectionObserver' in window) {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        markIn(entry.target);
        revealIO.unobserve(entry.target);
      });
    }, {
      threshold: 0.22,
      rootMargin: '0px 0px -6% 0px'
    });
  } else {
    document.documentElement.classList.remove('contact-js');
  }

  function setFaq(button, open) {
    var item = button.closest('[data-faq-item]');
    var panel = document.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (item) item.classList.toggle('is-open', open);
    if (panel) {
      if (open) panel.removeAttribute('inert');
      else panel.setAttribute('inert', '');
    }
  }

  function bindFaq(root) {
    root.querySelectorAll('[data-contact-faq]').forEach(function (section) {
      section.classList.add('is-enhanced');
    });
    root.querySelectorAll('[data-faq-toggle]').forEach(function (button) {
      if (button.getAttribute('data-contact-bound') === 'true') return;
      button.setAttribute('data-contact-bound', 'true');
      if (button.getAttribute('aria-expanded') !== 'true') setFaq(button, false);
      button.addEventListener('click', function () {
        var section = button.closest('[data-contact-faq]');
        var willOpen = button.getAttribute('aria-expanded') !== 'true';
        if (section) {
          section.querySelectorAll('[data-faq-toggle]').forEach(function (other) {
            if (other !== button) setFaq(other, false);
          });
        }
        setFaq(button, willOpen);
      });
    });
  }

  function closeSelect(wrap) {
    wrap.classList.remove('is-open');
    var button = wrap.querySelector('.contact-select__button');
    var panel = wrap.querySelector('.contact-select__panel');
    if (button) button.setAttribute('aria-expanded', 'false');
    if (panel) panel.setAttribute('inert', '');
  }

  function bindSelects(root) {
    root.querySelectorAll('.contact-field__select').forEach(function (wrap) {
      if (wrap.getAttribute('data-select-bound') === 'true') return;
      var select = wrap.querySelector('select');
      if (!select) return;
      wrap.setAttribute('data-select-bound', 'true');
      wrap.classList.add('is-ready');
      select.classList.add('contact-select__native');
      select.setAttribute('tabindex', '-1');
      select.setAttribute('aria-hidden', 'true');
      select.removeAttribute('required');

      var listId = select.id + '-list';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'contact-select__button is-placeholder';
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', listId);
      button.setAttribute('aria-required', 'true');

      var panel = document.createElement('div');
      panel.className = 'contact-select__panel';
      var list = document.createElement('ul');
      list.className = 'contact-select__list';
      list.id = listId;
      list.setAttribute('role', 'listbox');
      panel.appendChild(list);
      panel.setAttribute('inert', '');

      var placeholder = 'Choose a reason';
      Array.prototype.forEach.call(select.options, function (option) {
        if (!option.value) {
          placeholder = option.text;
          return;
        }
        var choice = document.createElement('li');
        var choiceButton = document.createElement('button');
        choiceButton.type = 'button';
        choiceButton.className = 'contact-select__option';
        choiceButton.setAttribute('role', 'option');
        choiceButton.setAttribute('data-value', option.value);
        choiceButton.textContent = option.text;
        choiceButton.addEventListener('click', function () {
          select.value = option.value;
          button.textContent = option.text;
          button.classList.remove('is-placeholder');
          button.removeAttribute('aria-invalid');
          list.querySelectorAll('.contact-select__option').forEach(function (node) {
            var selected = node === choiceButton;
            node.classList.toggle('is-selected', selected);
            node.setAttribute('aria-selected', selected ? 'true' : 'false');
          });
          closeSelect(wrap);
          button.focus();
        });
        choice.appendChild(choiceButton);
        list.appendChild(choice);
      });

      button.textContent = placeholder;
      button.addEventListener('click', function () {
        var open = wrap.classList.contains('is-open');
        document.querySelectorAll('.contact-field__select.is-open').forEach(function (other) {
          if (other !== wrap) closeSelect(other);
        });
        if (open) {
          closeSelect(wrap);
          return;
        }
        wrap.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('inert');
      });
      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        wrap.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('inert');
        var current = list.querySelector('.is-selected') || list.querySelector('.contact-select__option');
        if (current) current.focus();
      });
      list.addEventListener('keydown', function (event) {
        var options = Array.prototype.slice.call(list.querySelectorAll('.contact-select__option'));
        var index = options.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' && index > -1 && index < options.length - 1) {
          event.preventDefault();
          options[index + 1].focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (index <= 0) button.focus();
          else options[index - 1].focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeSelect(wrap);
          button.focus();
        }
      });

      wrap.appendChild(button);
      wrap.appendChild(panel);

      var form = select.form;
      if (form && form.getAttribute('data-reason-bound') !== 'true') {
        form.setAttribute('data-reason-bound', 'true');
        form.addEventListener('submit', function (event) {
          var pending = form.querySelector('.contact-select__native');
          if (pending && !pending.value) {
            event.preventDefault();
            var trigger = pending.parentNode.querySelector('.contact-select__button');
            if (trigger) {
              trigger.setAttribute('aria-invalid', 'true');
              trigger.focus();
            }
          }
        });
      }
    });
  }

  if (!window.__contactSelectOutside) {
    window.__contactSelectOutside = true;
    document.addEventListener('click', function (event) {
      document.querySelectorAll('.contact-field__select.is-open').forEach(function (wrap) {
        if (!wrap.contains(event.target)) closeSelect(wrap);
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.contact-field__select.is-open').forEach(closeSelect);
    });
  }

  function boot(scope) {
    var root = scope || document;
    bindFaq(root);
    bindSelects(root);
    root.querySelectorAll('[data-contact-lines], [data-contact-watch]').forEach(function (el) {
      if (el.getAttribute('data-contact-bound') === 'true') return;
      el.setAttribute('data-contact-bound', 'true');
      if (reduce || !revealIO) {
        markIn(el);
        return;
      }
      revealIO.observe(el);
    });
  }

  boot(document);
  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });
})();
