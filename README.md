Bitflow
=======

![Screenshot](https://gitorious.org/bitflow/bitflow/raw/bb209f1bf23a328754f321a00840d9750f062434:screenshot-1.png)

#Getting Started

Bitflow runs on [Bitcore](http://bitcore.io/) and [Node.js](http://nodejs.org/), and can be installed via [npm](https://npmjs.org/):

```
npm install bitflow
```

Here is an example.js file that will start the Bitflow server and will be accessible from a web browser at http://127.0.0.1:8080/ on a local machine:

```

var bitflow = require('bitflow');

var config = {
    host : 'http://127.0.0.1', // host for the web server
    port : '8080', // port for the web server
    debug : false, // true or false
    network : 'livenet', // livenet or testnet
    max_peers : 6
}

var server = new bitflow.BitflowServer(config);

```

And run example.js using node:

```
$ node example.js

```

Another means is to use the start script bitflow.js that is included in the module and to set environment variables:

```
$ export BITFLOW_HOST='http://example.com'
$ export BITFLOW_PORT='80'
$ node /path/to/module/bitflow.js

```
