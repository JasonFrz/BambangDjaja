const test = require('node:test');
const assert = require('node:assert/strict');

// Route yang mengubah data harus punya middleware peran (requireRole) sebelum handler.
function handlerCount(router, method, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  assert.ok(layer, `route ${method.toUpperCase()} ${path} tidak ditemukan`);
  return layer.route.stack.length;
}

test('route trafo yang mengubah nama/foto dijaga peran', () => {
  const trafo = require('../routes/trafo');
  assert.ok(handlerCount(trafo, 'put', '/:id/name') >= 2, 'PUT /:id/name tanpa requireRole');
  assert.ok(handlerCount(trafo, 'post', '/:id/image') >= 3, 'POST /:id/image tanpa requireRole');
  assert.ok(handlerCount(trafo, 'delete', '/:id/image') >= 2, 'DELETE /:id/image tanpa requireRole');
  assert.ok(handlerCount(trafo, 'put', '/:id/data') >= 2);
});

test('route uji WhatsApp dijaga peran', () => {
  const wa = require('../routes/whatsappRoutes');
  assert.ok(handlerCount(wa, 'post', '/test') >= 2, 'POST /test tanpa requireRole');
});
