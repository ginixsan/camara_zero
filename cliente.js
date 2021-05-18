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
var presencia=false;
var serial;
let cameraInUse = false;
var anterior=0;
let deteccionMientras=false;
let parando=false;
let timer;
let nombreVideo;
let contadorImagen=0;


function saltaFrames(value) {
	if (value%6== 0||(value<6 && value%2==0)||value==0)
		return true;
	else
		return false;
}


function broadcastFrame(data,nombreVideo=null) {
    if(hayPresencia==true)
    {
        socketCentral.emit('imagenPresencia',{
            frame:data,
            camera:serial,
            video:nombreVideo,
            contador:contadorImagen,
            presencia:true
        });
        contadorImagen++;
        if(saltaFrames(contadorImagen))
        {
            socketCerebro.emit('presenciaFrame',{
                frame:data,
                serial:serial
            });
        }
        
    }
    else
    {
        socketCentral.emit('imagenLive',{
            frame:data,
            camera:serial
    
        });
    }
    
};


async function startCamera() {
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
    await streamCamera.startCapture().then(() => {
        console.log(`# Camera started`);
        cameraInUse=true;
    })
    .catch(e => {
        console.log(`% Error opening camera: ${e}`);
    });
    
    streamCamera.on('frame', data => {
        // you can add some processing to frame data here
        // e.g let Mat = cv.imdecode(data)
        //console.log('tengo frame');

        if(hayPresencia==false)
        {
            nombreVideo=null;
        }
        broadcastFrame(data,nombreVideo)
        
    });
    return streamCamera;
}
async function stopCamera(streamCamera) {
    //streamCamera.stopCapture();
    if(hayPresencia==true)
    {
        if(deteccionMientras==false && presencia==false)
        {
            console.log('paro el video');
            (async () =>{
                sensorPresencia.unwatch(function(){
                    streamCamera.stopCapture().then(() => {
                        cameraInUse=false;
                        deteccionMientras=false;
                        parando=false;
                        hayPresencia=false;
                        presencia=false;
                        socketCentral.emit('finVideo',{
                            video:nombreVideo,
                            serial:serial
                        });
                        contadorImagen=0;
                    });
                });
            })();
        }
        else
        {
            console.log('no paro el video porque aun hay alguien');
            deteccionMientras=false;
            clearTimeout(timer);
            timer=setTimeout(function(){
                (async () =>{
                        await stopCamera(camara);
                })();
            },8000);
        }
    }
    else
    {
        (async () =>{
            sensorPresencia.unwatch(function(){
                streamCamera.stopCapture().then(() => {
                    cameraInUse=false;
                    deteccionMientras=false;
                    parando=false;
                    hayPresencia=false;
                    contadorImagen=0;
                    presencia=false;
                    arrancaSensor(sensorPresencia);
                });
            });
            
        })(); 
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
            socketCentral=socketCliente;
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
            socketCerebro=socket1;
        });

        socket1.on('disconnect', function(){
            console.log('me he desoncectado');
        });
        return socket1;
    }); 
}


//var streamCamera=startCamera(socketCliente);
function arrancaSensor(sensor)
{
    sensor.watch((err, value) => {
        if (err) {
            throw err;
        }
        if(value==1)
        {
            presencia=true;
            //hay presencia
            if(cameraInUse==false)
            {
                (async () =>{
                    console.log('hay alguien');
                    console.log('grabo video');
                    hayPresencia=true;
                    parando=false;
                    deteccionMientras=false;
                    nombreVideo=serial+'_'+moment().format("DD_MM_YYYY_HH_mm_ss_SSS");
                    camara=await startCamera(nombreVideo);
                })();
            }
            else
            {
                console.log('ya esta grabando');
                if(parando==true && deteccionMientras==false)
                {
                    console.log('esta parando y no habia detectado a nadie.pongo deteccionMient a true');
                    deteccionMientras=true;
                }
            }
        }
        else
        {
            presencia=false;
            //deja de haber presencia
            console.log('no hay nadie');
            if(cameraInUse==true&&parando==false)
            {
                console.log('ya esta grabando y no estaba parando. pongo parando y pongo timeout');
                parando=true;
                timer=setTimeout(function(){
                    (async () =>{
                        await stopCamera(camara);
                    })();
                },8000);
            }
            else
            {
                
                if(parando==true && cameraInUse==true)
                {
                    console.log('ya esta grabando y ya esta parando. pongo deteccion mientras a false');
                    deteccionMientras=false;
                }
            }
        }
    });
}


(async () =>{
    await openServerCentral();
    await openServerCerebro();
    arrancaSensor(sensorPresencia);
    // sensorPresencia.watch((err, value) => {
    //     if (err) {
    //         throw err;
    //     }
    //     if(value==1)
    //     {
    //         hayPresencia=true;
    //         if(anterior==0)
    //         {
    //             if(parando==true)
    //             {
    //                 deteccionMientras=true;
    //             }
    //             else
    //             {
    //                 if(cameraInUse==false)
    //                 {
    //                     console.log('hay alguien');
    //                     console.log('grabo video');
    //                     nombreVideo=moment().format("DD_MM_YYYY_HH_mm_ss_SSS")+'.h264';
    //                     camara=startCamera(socketCentral,socketCerebro,nombreVideo);
    //                 }
    //             }
    //             anterior=1;
    //         }
    //     }
    //     else
    //     {
    //         console.log('no hay nadie');
    //         if(cameraInUse==true)
    //         {
    //             parando=true;
    //             timer=setTimeout(stopCamera(camara),15000);
    //         }
    //         if(anterior==1)
    //         {
    //             anterior=0;
    //         }
    //     }
    // });
})();

