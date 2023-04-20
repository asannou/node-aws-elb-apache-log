#!/usr/bin/env node

module.exports = (bucket, prefix, cloudFrontDateTime = null) => {

    const {
        S3Client,
        GetObjectCommand,
        ListObjectsV2Command,
    } = require("@aws-sdk/client-s3");

    const MultiStream = require('multistream');

    const zlib = require('zlib');
    const { LineStream } = require('byline');
    const { Transform, PassThrough } = require('stream');
    const elbParser = require('elb-log-parser');
    const dateFormat = require('dateformat');

    const client = new S3Client();

    const logStream = async (bucket, key) => {

        const getObject = async (bucket, key) => {
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await client.send(command);
            return response.Body;
        };

        const lbLogStream = await getObject(bucket, key);
        lbLogStream.on("error", (err) => {
            console.error(err);
            lbLogStream.removeAllListeners("error");
            lbLogStream.emit("end");
        });

        const toString = new Transform({
            objectMode: true,
            transform: function(line, encoding, callback) {
                this.push(line.toString());
                callback();
            }
        });

        const fromALBToELB = new Transform({
            objectMode: true,
            transform: function(line, encoding, callback) {
                const alb = line.split(" ");
                const type = alb.shift();
                if (type == "http" || type == "https" || type == "h2") {
                    this.push(`${alb.join(" ")}\n`);
                } else {
                    console.error(`skip '${line}'`);
                }
                callback();
            }
        });

        const parseELB = new Transform({
            objectMode: true,
            transform: function(line, encoding, callback) {
                try {
                    this.push(elbParser(line));
                } catch (e) {
                    console.error(e);
                    console.error(`skip '${line}'`);
                }
                callback();
            }
        });

        const parseCloudFront = () => {
            let fields = [];
            return new Transform({
                objectMode: true,
                transform: function(line, encoding, callback) {
                    try {
                        if (line.startsWith('#')) {
                            const directive = line.substring(1);
                            const [name, values] = directive.split(/:\s*/);
                            if (name == 'Fields') {
                                fields = values.split(/\s+/);
                            }
                            return callback();
                        }
                        const log = {};
                        const entries = line.split(/\s+/);
                        for (let i = 0; i < fields.length; i++) {
                            log[fields[i]] = entries[i] == '-' ?
                                '' :
                                decodeURIComponent(entries[i]);
                        }
                        this.push({
                            client: log["c-ip"],
                            timestamp: `${log.date}T${log.time}Z`,
                            request_uri_query: log["cs-uri-query"],
                            request_uri_path: log["cs-uri-stem"],
                            request_method: log["cs-method"],
                            request_http_version: log["cs-protocol-version"],
                            backend_status_code: log["sc-status"],
                            sent_bytes: log["sc-bytes"],
                        });
                    } catch (e) {
                        console.error(e);
                        console.error(`skip '${line}'`);
                    }
                    callback();
                }
            });
        };

        const request = process.env.AWS_ELB_APACHE_LOG_ORIGIN ?
            (elb) => elb.request :
            (elb) => {
                const path = elb.request_uri_query ?
                    `${elb.request_uri_path}?${elb.request_uri_query}` :
                    elb.request_uri_path;
                return [
                    elb.request_method,
                    path,
                    elb.request_http_version
                ].join(' ');
            };

        const toApacheLog = new Transform({
            objectMode: true,
            transform: function(elb, encoding, callback) {
                const date = dateFormat(elb.timestamp, 'dd/mmm/yyyy:HH:MM:ss o');
                const apache = [
                    elb.client,
                    '-',
                    '-',
                    `[${date}]`,
                    `"${request(elb)}"`,
                    elb.backend_status_code,
                    elb.sent_bytes
                ];
                this.push(`${apache.join(' ')}\n`);
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
            pipe(toString).
            pipe(isALB ? fromALBToELB : new PassThrough({ objectMode: true })).
            pipe(isELB ? parseELB : parseCloudFront()).
            pipe(toApacheLog);

    };

    const listObjects = (bucket, prefix) => {
        const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
        return client.send(command);
    };

    const createMultiStream = (objects) => {
        const factory = (callback) => {
            const object = objects.shift();
            if (object && object.Size) {
                logStream(bucket, object.Key).
                    then((stream) => callback(null, stream));
            } else {
                callback(null, null);
            }
        };
        return new MultiStream(factory);
    };

    if (cloudFrontDateTime) {
        const dateTime = new Date(cloudFrontDateTime);
        const prevTime = new Date(cloudFrontDateTime);
        prevTime.setHours(prevTime.getHours() - 1);
        const promises = [prevTime, dateTime].map((dateTime) => {
            const dateHour = dateFormat(dateTime, 'UTC:yyyy-mm-dd-HH');
            return listObjects(bucket, `${prefix}${dateHour}.`);
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
    module.exports(...process.argv.slice(2)).
        then((stream) => stream.pipe(process.stdout));
}

