const { StreamCamera, Codec,Rotation,Flip } = require('pi-camera-connect');
const io = require("socket.io-client");
const exec = require( 'child_process' ).exec;

var camara,socket;
var hayPresencia=false;
var serial;



function broadcastFrame(data,socket) {
    if(hayPresencia==true)
    {
        socket.emit('imagenPresencia',{
            frame:data,
            camera:serial,
            video:'abc'
    
        });
    }
    else
    {
        socket.emit('imagenLive',{
            frame:data,
            camera:serial,
            video:'abc'
    
        });
    }
    
};
function openWsServer() {
        exec('cat /proc/cpuinfo | grep Serial',(error,stdout,stderr) => {
            if(error){
                console.error( `exec error: ${error}` );
                return;
            }
            //global.logger.info( `stdout: ${stdout}` );
            serial=stdout.split(':')[1];
            serial=serial.trim();
            console.log('el serial es '+serial);
            var socketCliente = require('socket.io-client')('https://socket1.biotechtonic.com/',{
                query: {
                access_token: 'camaron',
                serial:serial,
                camera:true
                }
            });

            socketCliente.on('connect', function(){
            console.log('conectado')
            });

            socketCliente.on('paraCamara', function(data){
                stopCamera(camara);
            });
            socketCliente.on('startLive', function(data){
                camara=startCamera(socketCliente);
            });
            socketCliente.on('disconnect', function(){
                console.log('me he desoncectado');
                stopCamera(camara);
                });
        return socketCliente;
    });
        
    
};
function startCamera(socket) {
    //TODO: SI EMPEZAMOS POR PRESENCIA QUE GRABE CON ALGO MAS DE DEFINICION?
    const streamCamera = new StreamCamera({
        codec: Codec.MJPEG,
        fps: 2,
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
    return streamCamera;
}
function stopCamera(streamCamera) {
    streamCamera.stopCapture();
}

//var streamCamera=startCamera(socketCliente);
socket=openWsServer();