const path = require('path');

module.exports = function (options, webpack) {
  return {
    ...options,
    cache: false, // Disable webpack cache to ensure fresh Prisma client
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        resourceRegExp: /^pg-native$/,
      }),
    ],
    resolve: {
      ...options.resolve,
      modules: [
        ...(options.resolve?.modules || []),
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '../../node_modules'),
      ],
      symlinks: false, // Don't resolve symlinks
    },
    resolveLoader: {
      ...options.resolveLoader,
      modules: [
        ...(options.resolveLoader?.modules || []),
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '../../node_modules'),
      ],
    },
  };
};

