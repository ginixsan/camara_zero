var config = require('./config');
const { StreamCamera, Codec,Rotation,Flip } = require('pi-camera-connect');
const io = require("socket.io-client");
const encrypt = require('socket.io-encrypt');
const exec = require( 'child_process' ).exec;
const moment=require('moment');
const Gpio = require('onoff').Gpio;
var SocketIO = require('socket.io-client');
const sensorPresencia = new Gpio(26, 'in', 'both',{
    debounceTimeout:1500
});

var camara;
var socketCentral;
var socketCerebro;
var hayPresencia=false;
var serial;
let cameraInUse = false;
var anterior=0;
let deteccionMientras=false;
let parando=false;
let timer;
let nombreVideo;
let contadorImagen=0;

function broadcastFrame(data,nombreVideo=null,socket1,socket2=null) {
    if(hayPresencia==true)
    {
        socket1.emit('imagenPresencia',{
            frame:data,
            camera:serial,
            video:nombreVideo,
            contador:contadorImagen
        });
        contadorImagen++;
        socket2.emit('presenciaFrame',{
            frame:data,
            serial:serial
        });
    }
    else
    {
        socket1.emit('imagenLive',{
            frame:data,
            camera:serial
    
        });
    }
    
};


function startCamera(socket1,socket2=null,nombreVideo=null) {
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
        if(hayPresencia==false)
        {
            nombreVideo=null;
            broadcastFrame(data,nombreVideo,socket1)
        }
        else
        {
            console.log(socketCerebro);
            broadcastFrame(data,nombreVideo,socket1,socket2);
        }
        
    });
    return streamCamera;
}
function stopCamera(streamCamera) {
    //streamCamera.stopCapture();
    if(hayPresencia==true)
    {
        if(deteccionMientras==false)
        {
            console.log('paro el video');
            streamCamera.stopCapture().then(() => {
                cameraInUse=false;
                deteccionMientras=false;
                parando=false;
                hayPresencia=false;
                socketCentral.emit('finVideo',{
                    video:nombreVideo,
                    serial:serial
                })
                contadorImagen=0;
            });
        }
        else
        {
            console.log('no paro el video porque aun hay alguien');
            deteccionMientras=false;
            clearTimeout(timer);
            timer=setTimeout(paraGrabacion,15000);
        }
    }
    else
    {
        streamCamera.stopCapture(); 
    }
    
}

async function openServerCentral() {
    exec('cat /proc/cpuinfo | grep Serial',(error,stdout,stderr) => {
        if(error){
            console.error( `exec error: ${error}` );
            return;
        }
        //global.logger.info( `stdout: ${stdout}` );
        serial=stdout.split(':')[1];
        serial=serial.trim();
        console.log('el serial es '+serial);
        var socketCliente = SocketIO('https://socket1.biotechtonic.com/',{
            query: {
            access_token: 'camaron',
            serial:serial,
            camera:true
            }
        });

        socketCliente.on('connect', function(){
            console.log('conectado central');
        });

        socketCliente.on('stopLive', function(data){
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
async function openServerCerebro()
{
    exec('cat /proc/cpuinfo | grep Serial',(error,stdout,stderr) => {
        if(error){
            console.error( `exec error: ${error}` );
            return;
        }
        serial=stdout.split(':')[1];
        serial=serial.trim();
        console.log('el serial es '+serial);
        var socket1 = SocketIO(config.SERVIDOR,{
            query: {
            access_token: 'camaron',
            serial:serial,
            camera:true
            }
        });
        encrypt('secreto')(socket1);
        socket1.on('connect', function(){
            console.log('conectado cerebro')
        });

        socket1.on('disconnect', function(){
            console.log('me he desoncectado');
        });
        return socket1;
    }); 
}


//var streamCamera=startCamera(socketCliente);

(async () =>{
    socketCentral=await openServerCentral();
    socketCerebro=await openServerCerebro();
    sensorPresencia.watch((err, value) => {
        if (err) {
            throw err;
        }
        if(value==1)
        {
            hayPresencia=true;
            if(anterior==0)
            {
                if(parando==true)
                {
                    deteccionMientras=true;
                }
                else
                {
                    if(cameraInUse==false)
                    {
                        console.log('hay alguien');
                        console.log('grabo video');
                        nombreVideo=moment().format("DD_MM_YYYY_HH_mm_ss_SSS")+'.h264';
                        camara=startCamera(socketCentral,socketCerebro,nombreVideo);
                    }
                }
                anterior=1;
            }
        }
        else
        {
            console.log('no hay nadie');
            if(cameraInUse==true)
            {
                parando=true;
                timer=setTimeout(stopCamera(camara),15000);
            }
            if(anterior==1)
            {
                anterior=0;
            }
        }
    });
})();

