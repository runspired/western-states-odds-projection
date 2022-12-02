'use strict';

module.exports = {
  name: require('./package').name,

  isDevelopingAddon() {
    return true;
  },

  serverMiddleware: function ({ app }) {
    app.use(function addOriginPolicyHeaders(req, res, next) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });

    // ember-cli is a bad citizen, we need to get in front
    const handler = app._router.stack.pop();
    app._router.stack.unshift(handler);
  },
};
