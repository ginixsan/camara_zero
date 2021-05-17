const dotenv = require('dotenv');
const path = require('path');
dotenv.config({
    path: path.resolve(__dirname, process.env.NODE_ENV + '.env')
});
module.exports = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    HOST: process.env.HOST || '127.0.0.1',
    PORT: process.env.PORT || 3000,
    SERVIDOR: process.env.SERVIDOR || 'http://192.168.1.144:8000',
    TIPO_APARATO:process.env.TIPO_APARATO || 1,
    SONIDO:process.env.SONIDO || 1000,
    HUMO:process.env.HUMO || 10000,
    PUERTA:process.env.PUERTA || 1,
    SENSORES:process.env.SENSORES || false

}