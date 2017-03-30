#!/usr/bin/env node

module.exports = (bucket, prefix) => {

    const AWS = require('aws-sdk');
    const MultiStream = require('multistream');

    const LineStream = require('byline').LineStream;
    const stream = require('stream');
    const parse = require('elb-log-parser');
    const dateFormat = require('dateformat');

    const s3 = new AWS.S3();

    const logStream = (bucket, key) => {
        const elbLog = s3.getObject({ Bucket: bucket, Key: key });
        const toApacheLog = line => {
            const elb = parse(line.toString());
            const path = elb.request_uri_query ?
                elb.request_uri_path + '?' + elb.request_uri_query :
                elb.request_uri_path;
            const apache = [
                elb.client,
                '-',
                '-',
                '[' + dateFormat(elb.timestamp, 'dd/mmm/yyyy:HH:MM:ss +0000') + ']',
                '"' + [elb.request_method, path, elb.request_http_version].join(' ') + '"',
                elb.backend_status_code,
                elb.sent_bytes
            ];
            return apache.join(' ');
        };
        const elbLogStream = elbLog.createReadStream();
        return elbLogStream.
            on("error", (err) => {
                const request = [
                    elbLog.operation,
                    elbLog.params.Bucket,
                    elbLog.params.Key
                ];
                console.error(err.code + ": " + request.join(" "));
                elbLogStream.removeAllListeners("error");
                elbLogStream.emit("end");
            }).
            pipe(new LineStream()).
            pipe(new stream.Transform({
                objectMode: true,
                transform: function(line, encoding, callback) {
                    this.push(toApacheLog(line) + '\n');
                    callback();
                }
            }));
    };

    return s3.
        listObjects({ Bucket: bucket, Prefix: prefix }).
        promise().
        then(data => {
            const objects = data.Contents;
            const factory = callback => {
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
    module.exports(bucket, prefix).then(stream => stream.pipe(process.stdout));
}

