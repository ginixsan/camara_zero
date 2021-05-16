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
    socket.emit('imagen',{
        frame:data,
        camera:'dsdsdsds',
        video:'abc'

    })
};
function openWsServer() {
    var socketCliente = require('socket.io-client')('https://socket1.biotechtonic.com/',{
        query: {
          access_token: 'camaron',
          serial:'100000009c73d022'
        }
      });

      socketCliente.on('connect', function(){
        console.log('conectado')
      });

      socketCliente.on('event', function(data){});

      socketCliente.on('disconnect', function(){
        console.log('me he desoncectado');
      });
    return socketCliente;
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
// var socketCliente = require('socket.io-client')('https://socket1.biotechtonic.com/',{
//         query: {
//           access_token: 'camaron',
//           serial:data
//         }
//       });

//       socketCliente.on('connect', function(){
//         console.log('conectado')
//       });

//       socketCliente.on('event', function(data){});

//       socketCliente.on('disconnect', function(){
//         console.log('me he desoncectado');
//       });
var socketCliente = openWsServer();
startCamera(socketCliente);