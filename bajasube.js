const extract = require('extract-zip');
const request = require('request');
const fs = require('fs');
const archiver = require('archiver');
const { exec,execSync } = require("child_process");
const moment = require('moment');

async function bajaNuevaVersion(url,directorio,proceso){
    const response = await Axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
    });
    response.data.pipe(Fs.createWriteStream('repo.zip'));
    return new Promise((resolve, reject) => {
            response.data.on('end', () => {
                (async () => {
                    try {
                        await extract('./repo.zip', { dir: directorio})
                        console.log('Extraction complete');
                        fs.unlinkSync("./repo.zip");
                        let vuelta = execSync('npm install');
                        exec("pm2 restart "+proceso, (error, stdout, stderr) => {
                            if (error) {
                                console.log(`error: ${error.message}`);
                                reject(error);
                            }
                            if (stderr) {
                                console.log(`stderr: ${stderr}`);
                                reject(stderr);
                            }
                            console.log(`stdout: ${stdout}`);
                            resolve();
                        });
                    } catch (err) {
                        // handle any errors
                        console.log(err);
                        reject(err);

                    } 
                })();
            })
            response.data.on('error', () => {
                reject(err);
            })        
        });
}

async function enviaLogs(directorioLogs,serial,direccion)
{
    (async () => {
        console.log('hay que enviar logs');
        const fecha=moment().format("DD_MM_YYYY_HH_mm_ss");
        const nombreArchivo=fecha+'_'+serial+'.zip';
        const output = fs.createWriteStream(directorioLogs+nombreArchivo);
        const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
        });
        
        output.on('close', function() {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            var form = {
                'myFile': fs.createReadStream(directorioLogs+nombreArchivo),
            };
            
            var options = {
                uri: direccion,
                method: 'POST',
                formData: form
            };
        
            request(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log('enviado zip logs')
                    console.log(body);
                    fs.unlinkSync(directorioLogs+nombreArchivo);
                    exec("pm2 flush camara", (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                            return;
                        }
                        console.log(`stdout: ${stdout}`);
                    });
                }
                else
                {
                    if(body=="Forbidden")
                    {
                        console.log("FORBIDDEN envio log");
                    }
                    else
                    {
                        console.log(error);
                        console.log(body);
                        console.log(response);
                    }
                    
                }
            });
        });
        archive.pipe(output);
        archive.directory(directorioLogs, false);
        archive.finalize();
    })();
}

exports.bajaNuevaVersion=bajaNuevaVersion;
exports.enviaLogs=enviaLogs;