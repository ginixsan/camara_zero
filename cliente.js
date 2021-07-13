var config = require('./config');
const { StreamCamera, Codec, Rotation, Flip } = require('pi-camera-connect');
const io = require("socket.io-client");
const exec = require('child_process').exec;
const moment = require('moment');
const Gpio = require('pigpio').Gpio;
var SocketIO = require('socket.io-client');
const fs = require('fs');
var sensorPresencia = new Gpio(26, { mode: Gpio.INPUT, alert: true });
const bajasube = require('./bajasube.js');


const zeroPad = (num, places) => String(num).padStart(places, '0');

const getDirectories = source =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);


var camara;
var socketCentral;
var socketCerebro;
var hayPresencia = false;
var presencia = false;
var serial;
let cameraInUse = false;
var anterior = 0;
let deteccionMientras = false;
let parando = false;
let timer;
let nombreVideo;
let contadorImagen = 0;
let hayWifi = true;
let contador = 0;

function saltaFrames(value) {
    if (value % 6 == 0 || (value < 6 && value % 2 == 0) || value == 0)
        return true;
    else
        return false;
}


function broadcastFrame(data, contadorImagen, nombreVideo = null) {
    if (hayPresencia == true) {
        socketCentral.emit('imagenPresencia', {
            frame: data,
            camera: serial,
            video: nombreVideo,
            contador: contadorImagen,
            presencia: true
        });
        //contadorImagen++;
        if (saltaFrames(contadorImagen)) {
            socketCerebro.emit('presenciaFrame', {
                frame: data,
                serial: serial
            });
        }

    }
    else {
        socketCentral.emit('imagenLive', {
            frame: data,
            camera: serial

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
        flip: Flip.Both
    });
    await streamCamera.startCapture().then(() => {
        console.log(`# Camera started`);
        cameraInUse = true;
        if (hayWifi == false) {
            fs.mkdir('./videos/' + nombreVideo);
        }
    })
        .catch(e => {
            console.log(`% Error opening camera: ${e}`);
        });

    streamCamera.on('frame', data => {
        // you can add some processing to frame data here
        // e.g let Mat = cv.imdecode(data)
        //console.log('tengo frame');

        if (hayPresencia == false) {
            nombreVideo = null;
        }
        if (hayWifi == true) {
            broadcastFrame(data, nombreVideo, contadorImagen);
        }
        else {
            fs.writeFile('./videos/' + nombreVideo + '/image' + zeroPad(contadorImagen, 7) + '.jpeg', data);
        }
        contadorImagen++;

    });
    return streamCamera;
}
async function stopCamera(streamCamera) {
    //streamCamera.stopCapture();
    if (hayPresencia == true) {
        if (deteccionMientras == false && presencia == false) {
            console.log('paro el video');
            (async () => {
                sensorPresencia.disableAlert();
                console.log('quitado sensor');
                streamCamera.stopCapture().then(() => {
                    cameraInUse = false;
                    deteccionMientras = false;
                    parando = false;
                    hayPresencia = false;
                    presencia = false;
                    socketCentral.emit('finVideo', {
                        video: nombreVideo,
                        serial: serial
                    });
                    contadorImagen = 0;
                    sensorPresencia.enableAlert();
                });
            })();
        }
        else {
            console.log('no paro el video porque aun hay alguien');
            deteccionMientras = false;
            clearTimeout(timer);
            timer = setTimeout(function () {
                (async () => {
                    await stopCamera(camara);
                })();
            }, 8000);
        }
    }
    else {
        (async () => {
            sensorPresencia.disableAlert();
            console.log('quitado sensor');
            streamCamera.stopCapture().then(() => {
                cameraInUse = false;
                deteccionMientras = false;
                parando = false;
                hayPresencia = false;
                contadorImagen = 0;
                presencia = false;
                contador = 0;
                sensorPresencia.enableAlert();
            });

        })();
    }

}

async function openServerCentral() {
    exec('cat /proc/cpuinfo | grep Serial', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        //global.logger.info( `stdout: ${stdout}` );
        serial = stdout.split(':')[1];
        serial = serial.trim();
        console.log('el serial es ' + serial);
        var socketCliente = SocketIO('https://socket1.biotechtonic.com/', {
            query: {
                access_token: 'camaron',
                serial: serial,
                tipo: 'camara'
            }
        });

        socketCliente.on('connect', function () {
            console.log('conectado central');
            //socketCliente.join('camaras');
        });
        socketCliente.on("connect_error", (err) => {
            console.log(`connect_error due to ${err}`);
        });
        socketCliente.on('stopLive', function (data) {
            stopCamera(camara);
        });
        socketCliente.on('startLive', function (data) {
            camara = startCamera(socketCliente);
        });
        socketCliente.on('bajaNuevaVersion', function (data) {
            console.log('llega nueva version');
            (async () => {
                await bajasube.bajaNuevaVersion(data.url, data.directorio, data.proceso);
            });
        });
        socketCliente.on('enviaLogCamaras', function (data) {
            bajasube.enviaLogs(data.directorioLogs, serial, data.direccion);
        });
        socketCliente.on('disconnect', function () {
            console.log('me he desoncectado');
            if (cameraInUse == true) stopCamera(camara);
        });
        socketCliente.on('reconnect', function (numero) {
            console.log('me he reconnect ' + numero + ' veces');
        });
        socketCliente.on('reconnecting', function (numero) {
            console.log('me he reconnecting ' + numero + ' veces');
        });
        socketCliente.on('connect_timeout', function () {
            console.log('me he connect_timeout');
        });
        socketCliente.on('reconnect_attempt', function () {
            console.log('me he reconnect_attempt');
        });
        socketCliente.on('reconnect_failed', function () {
            console.log('me he reconnect_failed');
        });
        socketCliente.on('reconnect_error', function (err) {
            console.log(`connect_error due to ${err.message}`);
        });
        socketCentral = socketCliente;
        return socketCliente;
    });


};
async function openServerCerebro() {
    exec('cat /proc/cpuinfo | grep Serial', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        serial = stdout.split(':')[1];
        serial = serial.trim();
        console.log('el serial es ' + serial);
        var socket1 = SocketIO(config.SERVIDOR, {
            query: {
                access_token: 'camaron',
                serial: serial,
                camera: true
            }
        });
        socket1.on('connect', function () {
            console.log('conectado cerebro');
            //socket1.join('camaras');
            socketCerebro = socket1;
        });

        socket1.on('disconnect', function () {
            console.log('me he desoncectado');
        });
        socket1.on("connect_error", (err) => {
            console.log(`connect_error due to ${err}`);
        });
        socket1.on('reconnect', function (numero) {
            console.log('me he reconnect ' + numero + ' veces');
        });
        socket1.on('reconnecting', function (numero) {
            console.log('me he reconnecting ' + numero + ' veces');
        });
        socket1.on('connect_timeout', function () {
            console.log('me he connect_timeout');
        });
        socket1.on('reconnect_attempt', function () {
            console.log('me he reconnect_attempt');
        });
        socket1.on('reconnect_failed', function () {
            console.log('me he reconnect_failed');
        });
        socket1.on('reconnect_error', function (err) {
            console.log(`connect_error due to ${err}`);
        });
        socket1.on('noWifi', function (data) {
            console.log('llega no hay wifi');
            exec('sudo ufw enable', (error, stdout, stderr) => {
                if (error) {
                    console.log(error);
                }
                else {
                    if (stderr) {
                        console.log(stderr);
                    }
                    console.log(stdout);
                    hayWifi = false;
                }
            });
            //hayWifi=false;
            /*
                sudo ufw allow to 192.168.1.0/24
                sudo ufw allow from 192.168.1.0/24
                sudo ufw enable
            */
        });
        socket1.on('yesWifi', function (data) {
            console.log('llega si hay wifi');
            exec('sudo ufw disable', (error, stdout, stderr) => {
                if (error) {
                    console.log(error);
                }
                else {
                    if (stderr) {
                        console.log(stderr);
                    }
                    console.log(stdout);
                    hayWifi = true;
                    var directorio = require('path').resolve(__dirname + '/videos');
                    var dirs = getDirectories(directorio);
                    console.log(dirs);
                    dirs.map((dir) => {
                        let directoryPath = './videos/' + dir;
                        //passsing directoryPath and callback function
                        let files = fs.readdirSync(directoryPath);
                        if (files.length > 0) {
                            let contador = 0;
                            for await (file of files) {
                                (async () => {
                                    const contents = fs.readFileSync(directoryPath + '/' + file);
                                    console.log(contents);
                                    broadcastFrame(contents, directoryPath, contador);
                                    contador++;
                                })();
                            }
                            fs.rmdirSync(directoryPath, { recursive: true });
                        }
                    });
                }

            });
            // hayWifi=true; 

            /*
                sudo delete ufw allow to 192.168.1.0/24
                sudo delete ufw allow from 192.168.1.0/24
                sudo ufw disable
            */
        });
        return socket1;
    });
}


//var streamCamera=startCamera(socketCliente);
function arrancaSensor(sensor) {
    sensor.glitchFilter(300000);
    sensor.on('alert', (level, tick) => {
        if (level == 1) {
            presencia = true;
            //hay presencia
            if (cameraInUse == false) {
                (async () => {
                    console.log('hay alguien');
                    console.log('grabo video');
                    hayPresencia = true;
                    parando = false;
                    deteccionMientras = false;
                    nombreVideo = serial + '_' + moment().format("DD_MM_YYYY_HH_mm_ss_SSS");
                    camara = await startCamera(nombreVideo);
                })();
            }
            else {
                console.log('ya esta grabando');
                if (parando == true && deteccionMientras == false) {
                    console.log('esta parando y no habia detectado a nadie.pongo deteccionMient a true');
                    deteccionMientras = true;
                }
            }
        }
        else {
            presencia = false;
            //deja de haber presencia
            console.log('no hay nadie');
            if (cameraInUse == true && parando == false) {
                console.log('ya esta grabando y no estaba parando. pongo parando y pongo timeout');
                parando = true;
                timer = setTimeout(function () {
                    (async () => {
                        await stopCamera(camara);
                    })();
                }, 8000);
            }
            else {

                if (parando == true && cameraInUse == true) {
                    console.log('ya esta grabando y ya esta parando. pongo deteccion mientras a false');
                    deteccionMientras = false;
                }
            }
        }
    });
}


(async () => {
    socketCentral = await openServerCentral();
    socketCerebro = await openServerCerebro();
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

