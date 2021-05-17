'use strict';

const express        = require('express');
const path           = require('path');
const http = require('http');
const errorHandler   = require('errorhandler');
const logger         = require('morgan');
const methodOverride = require('method-override');
//const { StreamCamera, Codec,Rotation,Flip } = require('pi-camera-connect');
const WebSocket      = require('ws');
const socketIOProvider = require('socket.io');
const { info } = require('console');
// handle to our websocket server instance
var wsHandle;


function openWebServer() {
    var app = express();
    
    app.use(logger('dev'));
    app.use(methodOverride());

    app.use(express.static(path.join(__dirname, 'public')));

    if ('development' == app.get('env')) {
        app.use(errorHandler());
    }

    var listener = app.listen(8080, function() {
        let appPort = listener.address().port;

        console.log(`# Web server is listening on port ${appPort}`);
    });
    const server = http.Server(app);
    server.listen(8082, () => {
        console.log('Listening on', 8082);
    });
    return server;
};

function openWsServer() {
   // wsHandle = new WebSocket.Server({ port: 8081 });
    const io = socketIOProvider(server,{});
    console.log(`# WS server opened on ${8081}`);
    io.on('connection', (socket) => {
        console.log('socket conectado');
        socket.on('imagen', function(data) {
            io.sockets.emit('imagenweb',data);
        })

    });
    
};

function broadcastFrame(data) {
    if (wsHandle) {
        wsHandle.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                // we sending frame (jpeg image) as Buffer in binary mode
                ws.send(data, {binary: true});
            }
        });
    }
};

function startCamera() {
    const streamCamera = new StreamCamera({
        codec: Codec.MJPEG,
        fps: 20,
        width: 640,
        height: 480,
        // increase this to reduce compression artefacts
        bitRate: 10000000,
        flip:Flip.Both
    });
    streamCamera.startCapture().then(() => {
        console.log(`# Camera started`);
    })
    .catch(e => {
        console.log(`% Error opening camera: ${e}`);
    });
    
    streamCamera.on('frame', data => {
        // you can add some processing to frame data here
        // e.g let Mat = cv.imdecode(data)
        console.log('tengo frame');
        broadcastFrame(data);
    });
    
}

var server=openWebServer();
openWsServer(server);
//startCamera();
