module.exports = {
  apps : [{
    name: "camara",
    //script: "sudo /usr/local/bin/node index.js",
    script: "npm",
    args : "run prod",
    time:true,
    log_date_format : "DD-MM-YYYY HH:mm:ss Z",
    error_file: "/home/pi/camarazero/logs/camara_err.log",
    out_file: "/home/pi/camarazero/logs/camara_out.log", 
    log_file: '/home/pi/camarazero/logs/camara_combined.log',
    watch: false,
    "watch_options": {
      "followSymlinks": false
    },
    ignore_watch : ["datos","logs","node_modules",".node-persist/storage",".git"],
    /*env: {
      NODE_ENV: "development"    
    }*/
  }]
}
