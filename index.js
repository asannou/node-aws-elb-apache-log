#!/usr/bin/env node

module.exports = (bucket, prefix, dateTime = null) => {

    const AWS = require('aws-sdk');
    const MultiStream = require('multistream');

    const zlib = require('zlib');
    const { LineStream } = require('byline');
    const { Transform, PassThrough } = require('stream');
    const elbParser = require('elb-log-parser');
    const CloudFrontParser = require('cloudfront-log-parser');
    const dateFormat = require('dateformat');

    const s3 = new AWS.S3();

    const logStream = (bucket, key) => {

        const lbLog = s3.getObject({ Bucket: bucket, Key: key });
        const lbLogStream = lbLog.createReadStream();
        lbLogStream.on("error", (err) => {
            const request = [
                lbLog.operation,
                lbLog.params.Bucket,
                lbLog.params.Key
            ];
            console.error(err.code + ": " + request.join(" "));
            lbLogStream.removeAllListeners("error");
            lbLogStream.emit("end");
        });

        const fromALBToELB = new Transform({
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
        });

        const parseELB = new Transform({
            objectMode: true,
            transform: function(line, encoding, callback) {
                try {
                    this.push(elbParser(line.toString()));
                } catch (e) {
                    console.error(e);
                    console.error("skip '" + line + "'");
                }
                callback();
            }
        });

        const parseCloudFront = new Transform({
            objectMode: true,
            transform: function(line, encoding, callback) {
                try {
                    const logs = CloudFrontParser.parse(line, { format: 'web' });
                    const log = logs.shift();
                    this.push({
                        client: log["c-ip"],
                        timestamp: log.date + "T" + log.time + "Z",
                        request_uri_query: log["cs-uri-query"] == "-" ?
                            "" : log["cs-uri-query"],
                        request_uri_path: log["cs-uri-stem"],
                        request_method: log["cs-method"],
                        request_http_version: log["cs-protocol-version"],
                        backend_status_code: log["sc-status"],
                        sent_bytes: log["sc-bytes"],
                    });
                } catch (e) {
                    console.error(e);
                    console.error("skip '" + line + "'");
                }
                callback();
            }
        });

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

        const toApacheLog = new Transform({
            objectMode: true,
            transform: function(elb, encoding, callback) {
                const apache = [
                    elb.client,
                    '-',
                    '-',
                    '[' + date(elb) + ']',
                    '"' + request(elb) + '"',
                    elb.backend_status_code,
                    elb.sent_bytes
                ];
                this.push(apache.join(' ') + '\n');
                callback();
            }
        });

        const filename = key.split("/").pop();
        const isZipped = filename.endsWith(".gz");
        const [, part, , id] = filename.split("_");
        const isELB = part == "elasticloadbalancing";
        const isALB = isELB && id.match(/^app\./);

        return lbLogStream.
            pipe(isZipped ? zlib.createGunzip() : new PassThrough()).
            pipe(new LineStream()).
            pipe(isALB ? fromALBToELB : new PassThrough()).
            pipe(isELB ? parseELB : parseCloudFront).
            pipe(toApacheLog);

    };

    const listObjects = (bucket, prefix) => s3.
        listObjectsV2({ Bucket: bucket, Prefix: prefix }).
        promise();

    const createMultiStream = (objects) => {
        console.error(objects);
        const factory = (callback) => {
            const object = objects.shift();
            if (object && object.Size) {
                callback(null, logStream(bucket, object.Key));
            } else {
                callback(null, null);
            }
        };
        return Promise.resolve(new MultiStream(factory));
    };

    if (dateTime) {
        const prevTime = new Date(dateTime);
        prevTime.setHours(prevTime.getHours() - 1);
        dateTime = new Date(dateTime);
        const promises = [prevTime, dateTime].map((dateTime) => {
            const dateHour = dateFormat(dateTime, 'UTC:yyyy-mm-dd-HH');
            return listObjects(bucket, prefix + dateHour + ".");
        });
        const filter = (data) => {
            const objects = [];
            for (const datum of data) {
                for (const object of datum.Contents) {
                    const modified = new Date(object.LastModified);
                    const elapsed = dateTime - modified;
                    const period = 5 * 60 * 1000;
                    if (0 <= elapsed && elapsed < period) {
                        objects.push(object);
                    }
                }
            }
            return objects;
        };
        return Promise.all(promises).
            then(filter).
            then(createMultiStream);
    } else {
        return listObjects(bucket, prefix).
            then((data) => data.Contents).
            then(createMultiStream);
    }

};

if (require.main === module) {
    const [, , bucket, prefix, dateTime] = process.argv;
    module.exports(bucket, prefix, dateTime).
        then((stream) => stream.pipe(process.stdout));
}

