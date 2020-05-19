#!/usr/bin/env node

module.exports = (bucket, prefix) => {

    const AWS = require('aws-sdk');
    const MultiStream = require('multistream');

    const zlib = require('zlib');
    const LineStream = require('byline').LineStream;
    const stream = require('stream');
    const parse = require('elb-log-parser');
    const dateFormat = require('dateformat');

    const s3 = new AWS.S3();

    const logStream = (bucket, key) => {
        const lbLog = s3.getObject({ Bucket: bucket, Key: key });
        const lbLogStream = lbLog.createReadStream().
            on("error", (err) => {
                const request = [
                    lbLog.operation,
                    lbLog.params.Bucket,
                    lbLog.params.Key
                ];
                console.error(err.code + ": " + request.join(" "));
                lbLogStream.removeAllListeners("error");
                lbLogStream.emit("end");
            });
        const fromALBToELB = (albLog) => albLog.
            pipe(zlib.createGunzip()).
            pipe(new LineStream()).
            pipe(new stream.Transform({
                objectMode: true,
                transform: function(line, encoding, callback) {
                    const alb = line.toString().split(" ");
                    const type = alb[0];
                    if (type == "http" || type == "https" || type == "h2") {
                        alb.shift();
                        this.push(alb.join(" ") + '\n');
                    } else {
                        console.error("skip '" + line + "'");
                    }
                    callback();
                }
            }));
        const elbLogStream = key.endsWith(".gz") ?
            fromALBToELB(lbLogStream) :
            lbLogStream.pipe(new LineStream());
        const request = process.env.AWS_ELB_APACHE_LOG_ORIGIN ?
            (elb) => elb.request :
            (elb) => {
                const path = elb.request_uri_query ?
                    elb.request_uri_path + '?' + elb.request_uri_query :
                    elb.request_uri_path;
                return [
                    elb.request_method,
                    path,
                    elb.request_http_version
                ].join(' ');
            };
        const date = (elb) =>
            dateFormat(elb.timestamp, 'dd/mmm/yyyy:HH:MM:ss o');
        const toApacheLog = (line) => {
            const elb = parse(line.toString());
            const apache = [
                elb.client,
                '-',
                '-',
                '[' + date(elb) + ']',
                '"' + request(elb) + '"',
                elb.backend_status_code,
                elb.sent_bytes
            ];
            return apache.join(' ');
        };
        return elbLogStream.
            pipe(new stream.Transform({
                objectMode: true,
                transform: function(line, encoding, callback) {
                    try {
                        this.push(toApacheLog(line) + '\n');
                    } catch (e) {
                        console.error(e);
                        console.error("skip '" + line + "'");
                    }
                    callback();
                }
            }));
    };

    return s3.
        listObjects({ Bucket: bucket, Prefix: prefix }).
        promise().
        then((data) => {
            const objects = data.Contents;
            const factory = (callback) => {
                const object = objects.shift();
                if (object) {
                    callback(null, logStream(bucket, object.Key));
                } else {
                    callback(null, null);
                }
            };
            return Promise.resolve(MultiStream(factory));
        });

};

if (require.main === module) {
    const bucket = process.argv[2];
    const prefix = process.argv[3];
    module.exports(bucket, prefix).
        then((stream) => stream.pipe(process.stdout));
}

