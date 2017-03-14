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
        return elbLog.
            createReadStream().
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
            const streams = data.Contents.map(object => logStream(bucket, object.Key));
            return Promise.resolve(MultiStream(streams));
        });

};

if (require.main === module) {
    const bucket = process.argv[2];
    const prefix = process.argv[3];
    module.exports(bucket, prefix).then(stream => stream.pipe(process.stdout));
}

