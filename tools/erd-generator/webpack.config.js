const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/dvdtIntegration/webview.ts',
    output: {
        path: path.resolve(__dirname, 'dist', 'webview'),
        filename: 'webview.js',
        clean: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.webview.json'
                    }
                },
                exclude: /node_modules/
            }
        ]
    },
    target: 'web',
    devtool: 'source-map'
};
