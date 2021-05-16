const { StreamCamera, Codec,Rotation,Flip } = require('pi-camera-connect');
const io = require("socket.io-client");
function broadcastFrame(data,socket) {
    // if (wsHandle) {
    //     wsHandle.clients.forEach(ws => {
    //         if (ws.readyState === WebSocket.OPEN) {
    //             // we sending frame (jpeg image) as Buffer in binary mode
    //             ws.send(data, {binary: true});
    //         }
    //     });
    // }
    socket.emit('frame',data)
};
function openWsServer() {
    const socket = io("https://192.168.1.142:8082");
    socket.on("connect", () => {
        console.log(socket.id); // x8WIv7-mJelg7on_ALbx
    });
    
    socket.on("disconnect", () => {
    console.log(socket.id); // undefined
    });
    console.log(`# WS server opened on ${8082}`);
    return socket;
};
function startCamera(socket) {
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
        broadcastFrame(data,socket);
    });
    
}
var socket=openWsServer();
startCamera(socket);