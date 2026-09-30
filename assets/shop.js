/*
  Row hover for the shop grid.

  The hovered product scales up. The other products in the same row scale
  down. Rows are counted from the live column count, so a 3-column desktop
  row and a 2-column tablet row stay independent. Touch pointers are ignored.
*/
(function () {
  if (window.LumenShop) return;
  window.LumenShop = true;

  var hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function columns(grid) {
    var template = window.getComputedStyle(grid).gridTemplateColumns;
    var count = template.split(' ').filter(Boolean).length;
    return count || 1;
  }

  function clear(grid) {
    var items = grid.querySelectorAll('[data-shop-item]');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('is-focus', 'is-retreat');
    }
  }

  function focusItem(grid, item) {
    var items = grid.querySelectorAll('[data-shop-item]');
    var index = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i] === item) index = i;
    }
    if (index < 0) return;

    var count = columns(grid);
    var rowStart = Math.floor(index / count) * count;

    for (var n = 0; n < items.length; n++) {
      var sameRow = n >= rowStart && n < rowStart + count;
      items[n].classList.toggle('is-focus', sameRow && items[n] === item);
      items[n].classList.toggle('is-retreat', sameRow && items[n] !== item);
    }
  }

  function bind(grid) {
    grid.addEventListener('pointerover', function (event) {
      if (!hoverQuery.matches || motionQuery.matches) return;
      if (event.pointerType === 'touch') return;
      var item = event.target.closest('[data-shop-item]');
      if (!item || !grid.contains(item)) return;
      focusItem(grid, item);
    });

    grid.addEventListener('pointerleave', function () {
      clear(grid);
    });

    window.addEventListener('resize', function () {
      clear(grid);
    });

    if (typeof hoverQuery.addEventListener === 'function') {
      hoverQuery.addEventListener('change', function () {
        clear(grid);
      });
    }
  }

  var grids = document.querySelectorAll('[data-shop-grid]');
  for (var g = 0; g < grids.length; g++) bind(grids[g]);
})();
