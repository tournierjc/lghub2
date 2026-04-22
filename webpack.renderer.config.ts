import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';

const __dirname = import.meta.dirname;
const isDev = process.env.NODE_ENV !== 'production';

const config: webpack.Configuration & { devServer?: DevServerConfiguration } = {
  entry: './src/renderer/index.tsx',
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json',
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.scss', '.css'],
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist/renderer'),
    publicPath: 'auto',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
    ...(isDev ? [] : [new MiniCssExtractPlugin({ filename: 'styles.css' })]),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: 'tsconfig.renderer.json',
      },
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.resolve(__dirname, 'dist/renderer'),
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};

export default config;
