var data = [1, 2, 3];

function fn() {
  var [, c] = data;
  return c;
}

assertEqual(fn(), 2);
test(fn);
