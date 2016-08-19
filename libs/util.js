/**
 * Created by yuan on 2016/8/19.
 */
var os = require('os');
var interfaces = os.networkInterfaces();
for (var item in interfaces) {
    console.log('Network interface name: ' + item);
    for (var att in interfaces[item]) {
        var address = interfaces[item][att];

        console.log('Family: ' + address.family);
        console.log('IP Address: ' + address.address);
        console.log('Is Internal: ' + address.internal);
        console.log('');
    }
    console.log('==================================');
}


//logger
function logger(format) {
    return function *(next){
        var str = format
            .replace(':method', this.method)
            .replace(':url', this.url);

        console.log(str);

        yield next;
    }
}

app.use(logger(':method :url'));