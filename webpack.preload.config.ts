import path from 'path';
import webpack from 'webpack';

const __dirname = import.meta.dirname;

const config: webpack.Configuration = {
  entry: {
    preload: './src/preload/preload.ts',
    'marketplace-preload': './src/preload/marketplace-preload.ts',
  },
  target: 'electron-preload',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.main.json',
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@preload': path.resolve(__dirname, 'src/preload'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/main'),
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default config;
