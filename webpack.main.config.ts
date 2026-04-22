import path from 'path';
import webpack from 'webpack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const __dirname = import.meta.dirname;

const config: webpack.Configuration = {
  entry: './src/main/main.ts',
  target: 'electron-main',
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
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist/main'),
  },
  externals: {
    'node-hid': 'commonjs node-hid',
    'electron-store': 'commonjs electron-store',
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: 'tsconfig.main.json',
      },
    }),
  ],
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default config;
